const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer"); // Tekrar ekledik
const db = require("./db");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Gmail Transporter Kurulumu
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

// Yardımcı Mail Fonksiyonu
async function sendMail(to, subject, html) {
    return await transporter.sendMail({
        from: process.env.MAIL_USER,
        to: to,
        subject: subject,
        html: html
    });
}

// ===== AUTH MIDDLEWARE =====
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

// ===== TEST =====
app.get("/", (req, res) => res.send("Backend çalışıyor 👍"));

// ===== SEND CODE =====
app.post("/send-code", async (req, res) => {
    const { email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        await db.query(`INSERT INTO users (email, code, verified, password, role) VALUES ($1, $2, false, '', 'pending') ON CONFLICT (email) DO UPDATE SET code = $2, verified = false`, [email, code]);
        
        await sendMail(email, 'Doğrulama Kodunuz', `<p>Doğrulama kodunuz: <strong>${code}</strong></p>`);
        res.json({ message: "Kod gönderildi" });
    } catch (error) { 
        console.error("MAİL HATASI:", error);
        res.status(500).json({ message: "Mail gönderilemedi" }); 
    }
});

// ===== VERIFY CODE =====
app.post("/verify-code", async (req, res) => {
    const { email, code } = req.body;
    try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (!result.rows.length || result.rows[0].code !== code) return res.status(400).json({ message: "Kod hatalı" });
        await db.query("UPDATE users SET verified = true, code = NULL WHERE email = $1", [email]);
        res.json({ message: "Kod doğrulandı" });
    } catch { res.status(500).json({ message: "Sunucu hatası" }); }
});

// ===== SET PASSWORD =====
app.post("/set-password", async (req, res) => {
    const { email, password, role } = req.body;
    try {
        await db.query(`UPDATE users SET password = $1, role = $2 WHERE email = $3 AND verified = true`, [password, role, email]);
        await db.query("UPDATE invite SET used=true WHERE email=$1", [email]);
        res.json({ message: "Şifre kaydedildi" });
    } catch { res.status(500).json({ message: "Sunucu hatası" }); }
});

// ===== LOGIN =====
app.post("/login", async (req, res) => {
    const email = req.body.email ? req.body.email.trim() : "";
    const password = req.body.password;
    const role = req.body.role ? req.body.role.trim() : "";
    try {
        const result = await db.query("SELECT id, password, verified, role FROM users WHERE email ILIKE $1", [email]);
        if (!result.rows.length || result.rows[0].password !== password || !result.rows[0].verified) return res.status(401).json({ message: "Hatalı bilgiler" });
        if (result.rows[0].role.toLowerCase() !== role.toLowerCase()) return res.status(403).json({ message: "Yetkisiz rol" });
        
        const token = jwt.sign({ id: result.rows[0].id, role: result.rows[0].role }, process.env.JWT_SECRET, { expiresIn: "1d" });
        res.json({ token, userId: result.rows[0].id, role: result.rows[0].role });
    } catch { res.status(500).json({ message: "Sunucu hatası" }); }
});

// ===== GÖREV İŞLEMLERİ =====
app.post("/add-task", auth, async (req, res) => {
    const { title, assignedTo, assignedBy } = req.body;
    if (req.user.role !== "parent") return res.status(403).json({ message: "Yetkisiz" });
    try {
        await db.query(`INSERT INTO tasks (title, assigned_to, assigned_by, status, assigned_at) VALUES ($1, $2, $3, 'Başlamadı', NOW())`, [title, assignedTo, assignedBy]);
        res.json({ message: "Görev eklendi" });
    } catch { res.status(500).json({ message: "Görev eklenemedi" }); }
});

app.get("/my-tasks/:userId", auth, async (req, res) => {
    try {
        const result = await db.query(`SELECT t.id, t.title, t.status, t.assigned_at, u.email AS assigned_by FROM tasks t JOIN users u ON t.assigned_by = u.id WHERE t.assigned_to = $1`, [req.params.userId]);
        res.json(result.rows);
    } catch { res.status(500).json([]); }
});

app.get("/my-assigned-tasks/:userId", auth, async (req, res) => {
    try {
        const result = await db.query(`SELECT t.id, t.title, t.status, t.assigned_at, u.email AS assigned_to FROM tasks t JOIN users u ON t.assigned_to = u.id WHERE t.assigned_by = $1`, [req.params.userId]);
        res.json(result.rows);
    } catch { res.status(500).json([]); }
});

app.post("/update-task-status", auth, async (req, res) => {
    const { taskId, status } = req.body;
    try {
        const task = (await db.query("SELECT assigned_to, title FROM tasks WHERE id=$1", [taskId])).rows[0];
        if (!task || req.user.id != task.assigned_to) return res.status(403).json({ message: "Yetkisiz" });
        await db.query("UPDATE tasks SET status=$1 WHERE id=$2", [status, taskId]);

        const parent = (await db.query("SELECT email FROM users WHERE id = (SELECT assigned_by FROM tasks WHERE id=$1)", [taskId])).rows[0];
        if (parent) await sendMail(parent.email, "Görev Durumu Güncellendi", `Öğrenciniz "${task.title}" görevini "${status}" yaptı.`);
        res.json({ message: "Güncellendi" });
    } catch { res.status(500).json({ message: "Hata" }); }
});

// ===== DAVET İŞLEMLERİ =====
app.get("/check-invite", async (req, res) => {
    const result = await db.query("SELECT email FROM invite WHERE token=$1 AND used=false", [req.query.invite]);
    res.json(result.rows.length ? { valid: true, email: result.rows[0].email } : { valid: false });
});

app.post("/invite", auth, async (req, res) => {
    if (req.user.role !== "parent") return res.status(403).json({ message: "Yetkisiz" });
    const { email } = req.body;
    const token = crypto.randomBytes(32).toString("hex");
    try {
        await db.query("INSERT INTO invite (email, token) VALUES ($1, $2)", [email, token]);
        await sendMail(email, "Davet", `Kayıt olmak için: ${FRONTEND_URL}/kayit.html?invite=${token}`);
        res.json({ message: "Davet gönderildi" });
    } catch { res.status(500).json({ message: "Hata" }); }
});

app.get("/get-user-id", auth, async (req, res) => {
    const result = await db.query("SELECT id FROM users WHERE email=$1", [req.query.email]);
    res.json({ userId: result.rows[0]?.id || null });
});

app.listen(process.env.PORT || 3000, () => console.log("Server çalışıyor"));