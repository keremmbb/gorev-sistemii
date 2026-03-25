const express = require("express");
const cors = require("cors");
const { Resend } = require('resend');
const db = require("./db");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const resend = new Resend(process.env.RESEND_API_KEY);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// --- MIDDLEWARE ---
function auth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "Token yok" });
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ message: "Geçersiz token" });
    }
}

// --- MAIL HELPER ---
// ... (Dosyanın üst kısmı aynı kalacak)

// 2. TAM DİNAMİC MAIL FONKSİYONU
async function sendMail(to, subject, html) {
    try {
        const response = await resend.emails.send({
            from: 'onboarding@resend.dev', // Resend domainin yoksa burası sabit kalmalı
            to: to, // ARTIK SABİT DEĞİL: Kimin maili gelirse ona gider
            subject: subject,
            html: html
        });
        console.log("Mail gönderildi:", to);
        return response;
    } catch (error) {
        console.error("Resend Hatası (Muhtemelen Domain Onaysız):", error);
        throw error;
    }
}

// --- SEND CODE ROTASI ---
app.post("/send-code", async (req, res) => {
    const { email } = req.body;
    const cleanEmail = email.trim();
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    try {
        // Veritabanı işlemi
        await db.query(`
            INSERT INTO users (email, code, verified, password, role) 
            VALUES ($1, $2, false, '', 'pending') 
            ON CONFLICT (email) DO UPDATE SET code = $2, verified = false
        `, [cleanEmail, code]);

        // Mail Gönderimi: Direkt kullanıcıdan gelen temiz maile gönderiyoruz
        await sendMail(cleanEmail, 'Doğrulama Kodunuz', `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd;">
                <h2>Doğrulama Kodunuz</h2>
                <p>Kayıt işlemini tamamlamak için kodunuz aşağıdadır:</p>
                <h1 style="color: #4CAF50; letter-spacing: 5px;">${code}</h1>
            </div>
        `);

        res.json({ message: "Kod gönderildi!" });
    } catch (err) {
        console.error("HATA:", err);
        res.status(500).json({ message: "Mail gönderilemedi. Resend panelinden domaininizi onaylamış mısınız?" });
    }
});

// ... (Geri kalan rotalar /login, /set-password vb. aynı)
app.post("/verify-code", async (req, res) => {
    const { email, code } = req.body;
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length && result.rows[0].code === code) {
        await db.query("UPDATE users SET verified = true, code = NULL WHERE email = $1", [email]);
        return res.json({ message: "Kod doğrulandı" });
    }
    res.status(400).json({ message: "Kod hatalı" });
});

app.post("/set-password", async (req, res) => {
    const { email, password, role } = req.body;
    const result = await db.query("UPDATE users SET password=$1, role=$2 WHERE email=$3 AND verified=true", [password, role, email]);
    res.json(result.rowCount > 0 ? { message: "Başarılı" } : { message: "Hata" });
});

app.post("/login", async (req, res) => {
    const { email, password, role } = req.body;
    const result = await db.query("SELECT * FROM users WHERE email ILIKE $1", [email?.trim()]);
    const user = result.rows[0];
    if (user && user.password === password && user.role.toLowerCase() === role.toLowerCase()) {
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });
        return res.json({ token, userId: user.id, role: user.role, message: "Giriş başarılı" });
    }
    res.status(401).json({ message: "Bilgiler hatalı" });
});

// --- TASK ROUTES ---

app.post("/add-task", auth, async (req, res) => {
    const { title, assignedTo, assignedBy, due_date } = req.body;
    await db.query("INSERT INTO tasks (title, assigned_to, assigned_by, status, assigned_at, due_date) VALUES ($1, $2, $3, 'Başlamadı', NOW(), $4)", 
    [title, assignedTo, assignedBy, due_date]);
    res.json({ message: "Atandı" });
});

app.get("/my-tasks/:userId", auth, async (req, res) => {
    const result = await db.query("SELECT t.*, u.email as assigned_by FROM tasks t JOIN users u ON t.assigned_by = u.id WHERE t.assigned_to = $1", [req.params.userId]);
    res.json(result.rows);
});

app.get("/my-assigned-tasks/:userId", auth, async (req, res) => {
    const result = await db.query("SELECT t.*, u.email as assigned_to FROM tasks t JOIN users u ON t.assigned_to = u.id WHERE t.assigned_by = $1", [req.params.userId]);
    res.json(result.rows);
});

app.post("/update-task-status", auth, async (req, res) => {
    const { taskId, status } = req.body;
    await db.query("UPDATE tasks SET status = $1 WHERE id = $2", [status, taskId]);
    res.json({ message: "Güncellendi" });
});

app.delete("/delete-task/:id", auth, async (req, res) => {
    await db.query("DELETE FROM tasks WHERE id = $1 AND assigned_by = $2", [req.params.id, req.user.id]);
    res.json({ message: "Silindi" });
});

// --- INVITE ROUTES ---

app.post("/send-invite", auth, async (req, res) => {
    const { email } = req.body;
    const token = crypto.randomBytes(32).toString("hex");
    await db.query("INSERT INTO invite (email, token, used) VALUES ($1, $2, false)", [email, token]);
    const inviteLink = `${FRONTEND_URL}/kayit.html?invite=${token}`;
    await sendMail(email, "Davet", `Kayıt linkiniz: ${inviteLink}`);
    res.json({ message: "Gönderildi" });
});

app.get("/check-invite", async (req, res) => {
    const result = await db.query("SELECT email FROM invite WHERE token=$1 AND used=false", [req.query.invite]);
    res.json(result.rows.length ? { valid: true, email: result.rows[0].email } : { valid: false });
});

app.get("/get-user-id", auth, async (req, res) => {
    const result = await db.query("SELECT id FROM users WHERE email=$1", [req.query.email]);
    res.json({ userId: result.rows[0]?.id || null });
});

app.listen(process.env.PORT || 3000, () => console.log("Sistem Aktif"));