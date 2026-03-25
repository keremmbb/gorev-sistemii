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
async function sendMail(to, subject, htmlContent) {
    try {
        await resend.emails.send({
            from: 'Sistem <onboarding@resend.dev>',
            to: 'keremacar3754is@gmail.com', 
            subject: subject,
            html: `<div style="font-family:sans-serif; max-width:600px; margin:0 auto; border:1px solid #eee; border-radius:10px; overflow:hidden;">
                <div style="background-color:#4A90E2; padding:20px; text-align:center;"><h1 style="color:white; margin:0;">Görev Takip</h1></div>
                <div style="padding:30px; line-height:1.6; color:#333;">${htmlContent}</div>
            </div>`
        });
    } catch (error) { console.error("Mail Hatası:", error); }
}

// --- ROUTES ---
app.post("/send-code", async (req, res) => {
    const { email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await db.query("INSERT INTO users (email, code, verified, password, role) VALUES ($1, $2, false, '', 'student') ON CONFLICT (email) DO UPDATE SET code = $2", [email.trim(), code]);
    await sendMail(email, 'Doğrulama Kodunuz', `<h2>Kodunuz: ${code}</h2>`);
    res.json({ message: "Kod gönderildi" });
});

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
    await db.query("UPDATE users SET password=$1, role=$2 WHERE email=$3", [password, role, email]);
    res.json({ message: "Başarılı" });
});

app.post("/login", async (req, res) => {
    const { email, password, role } = req.body;
    const result = await db.query("SELECT * FROM users WHERE email ILIKE $1", [email?.trim()]);
    const user = result.rows[0];
    if (user && user.password === password && user.role.toLowerCase() === role.toLowerCase()) {
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });
        return res.json({ token, userId: user.id, role: user.role });
    }
    res.status(401).json({ message: "Hatalı giriş" });
});

app.post("/add-task", auth, async (req, res) => {
    const { title, description, assignedTo, assignedBy, due_date } = req.body;
    await db.query("INSERT INTO tasks (title, description, assigned_to, assigned_by, status, assigned_at, due_date) VALUES ($1, $2, $3, $4, 'Başlamadı', NOW(), $5)", 
    [title, description, assignedTo, assignedBy, due_date]);
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

app.post("/send-invite", auth, async (req, res) => {
    const { email } = req.body;
    const token = crypto.randomBytes(16).toString("hex");
    await db.query("INSERT INTO invite (email, token, used) VALUES ($1, $2, false)", [email, token]);
    const link = `${FRONTEND_URL}/kayit.html?invite=${token}`;
    await sendMail(email, "Davet Edildiniz", `<a href="${link}">Kayıt Olmak İçin Tıklayın</a>`);
    res.json({ message: "Davet gönderildi" });
});

app.get("/check-invite", async (req, res) => {
    const result = await db.query("SELECT email FROM invite WHERE token=$1 AND used=false", [req.query.invite]);
    res.json(result.rows.length ? { valid: true, email: result.rows[0].email } : { valid: false });
});

app.get("/get-user-id", auth, async (req, res) => {
    const result = await db.query("SELECT id FROM users WHERE email=$1", [req.query.email]);
    res.json({ userId: result.rows[0]?.id || null });
});

app.listen(3000, () => console.log("Server 3000'de hazır."));