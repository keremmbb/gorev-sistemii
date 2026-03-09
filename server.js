const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const db = require("./db");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ===== FRONTEND URL =====
const FRONTEND_URL = process.env.FRONTEND_URL;

// ===== AUTH MIDDLEWARE =====
function auth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "Token yok" });
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // id, email, role
        next();
    } catch {
        return res.status(401).json({ message: "Geçersiz token" });
    }
}

// ===== MAIL TRANSPORTER =====
const transporter = nodemailer.createTransport({
    service: "gmail", // Host yerine direkt service kullanmak daha stabildir
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS // Buraya aldığın 16 haneli kodu Render'a yazdığından emin ol
    },
    tls: {
        rejectUnauthorized: false // Bağlantı güvenliğini esnetir, hata payını düşürür
    }
});
// ===== TEST =====
app.get("/", (req, res) => res.send("Backend çalışıyor 👍"));

// ===== SEND CODE =====
// ===== SEND CODE =====
// ===== SEND CODE =====
// ===== SEND CODE =====
// server.js içindeki /send-code kısmını bu tırnak içindeki ('', 'pending') eklenmiş haliyle değiştir:

app.post("/send-code", async (req, res) => {
    const { email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    try {
    // ... DB işlemleri bittikten sonra ...
    console.log("Mail gönderimi başlıyor...");
    
    await transporter.sendMail({
        from: `"Görev Sistemi" <${process.env.MAIL_USER}>`,
        to: email,
        subject: "Doğrulama Kodu",
        text: `Doğrulama kodunuz: ${code}`
    });

    console.log("Mail başarıyla iletildi ✅");
    res.json({ message: "Kod gönderildi" });
} catch (error) {
    console.error("MAIL HATASI DETAYI:", error);
    res.status(500).json({ message: "Mail gönderilemedi", detail: error.message });
}
});

// ===== VERIFY CODE =====
app.post("/verify-code", async (req, res) => {
    const { email, code } = req.body;
    try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (!result.rows.length) return res.status(400).json({ message: "Kullanıcı bulunamadı" });
        if (result.rows[0].code !== code) return res.status(400).json({ message: "Kod hatalı" });

        await db.query("UPDATE users SET verified = true, code = NULL WHERE email = $1", [email]);
        res.json({ message: "Kod doğrulandı" });
    } catch {
        res.status(500).json({ message: "Sunucu hatası" });
    }
});

// ===== SET PASSWORD =====
app.post("/set-password", async (req, res) => {
    const { email, password, role } = req.body;
    try {
        await db.query(
            `UPDATE users SET password = $1, role = $2 WHERE email = $3 AND verified = true`,
            [password, role, email]
        );
        await db.query("UPDATE invite SET used=true WHERE email=$1", [email]);
        res.json({ message: "Şifre kaydedildi" });
    } catch {
        res.status(500).json({ message: "Sunucu hatası" });
    }
});

// ===== LOGIN =====
app.post("/login", async (req, res) => {
    // Trim() kullanarak gelen verilerin sonundaki boşlukları temizliyoruz
    const email = req.body.email ? req.body.email.trim() : "";
    const password = req.body.password;
    const role = req.body.role ? req.body.role.trim() : "";

    try {
        // ILIKE kullanarak emailin büyük/küçük harf duyarlılığını ortadan kaldırıyoruz
        const result = await db.query("SELECT id, password, verified, role FROM users WHERE email ILIKE $1", [email]);
        
        if (!result.rows.length) {
            return res.status(401).json({ message: "Mail bulunamadı" });
        }

        const user = result.rows[0];

        // 1. Şifre Kontrolü (Veritabanında düz metin ise)
        if (user.password !== password) {
            return res.status(401).json({ message: "Mail veya şifre hatalı" });
        }

        // 2. Doğrulama Kontrolü
        if (!user.verified) {
            return res.status(403).json({ message: "Mail doğrulanmamış" });
        }

        // 3. ROL KONTROLÜ (En kritik yer burası)
        // Hem veritabanındaki hem de gelen rolü küçük harfe çevirip öyle karşılaştırıyoruz
        if (user.role.toLowerCase() !== role.toLowerCase()) {
            console.log(`Rol Uyuşmazlığı: Gelen=${role}, DB=${user.role}`); // Debug için terminale yazar
            return res.status(403).json({ message: `Bu sayfaya giriş yetkiniz yok (Seçilen: ${role}, Mevcut: ${user.role})` });
        }

        // Token oluşturma
        const token = jwt.sign(
            { id: user.id, email, role: user.role }, 
            process.env.JWT_SECRET || "gizli_anahtar", 
            { expiresIn: "1d" }
        );

        res.json({ 
            message: "Giriş başarılı", 
            token, 
            userId: user.id, 
            role: user.role 
        });

    } catch (error) {
        console.error("Login Hatası:", error);
        res.status(500).json({ message: "Sunucu hatası" });
    }
});

// ===== VELİ GÖREV EKLE =====
app.post("/add-task", auth, async (req, res) => {
    const { title, assignedTo, assignedBy } = req.body;
    if (!title || !assignedTo || !assignedBy) return res.status(400).json({ message: "Eksik bilgi!" });
    if (req.user.role !== "parent") return res.status(403).json({ message: "Yetkiniz yok" });

    try {
        const studentCheck = await db.query("SELECT id FROM users WHERE id=$1 AND role='student'", [assignedTo]);
        if (!studentCheck.rows.length) return res.status(400).json({ message: "Bu öğrenciye görev atayamazsınız!" });

        await db.query(
            `INSERT INTO tasks (title, assigned_to, assigned_by, status, assigned_at)
             VALUES ($1, $2, $3, 'Başlamadı', NOW())`,
            [title, assignedTo, assignedBy]
        );

        res.json({ message: "Görev başarıyla eklendi" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Görev eklenemedi" });
    }
});

// ===== ÖĞRENCİ VE VELİ GÖREVLERİ GETİR =====
app.get("/my-tasks/:userId", auth, async (req, res) => {
    const { userId } = req.params;
    if (req.user.role !== "student" || req.user.id != userId) return res.status(403).json([]);
    try {
        const result = await db.query(
            `SELECT t.id, t.title, t.status, t.assigned_at, u.email AS assigned_by
             FROM tasks t
             JOIN users u ON t.assigned_by = u.id
             WHERE t.assigned_to = $1`,
            [userId]
        );
        res.json(result.rows);
    } catch {
        res.status(500).json([]);
    }
});

app.get("/my-assigned-tasks/:userId", auth, async (req, res) => {
    const { userId } = req.params;
    if (req.user.role !== "parent" || req.user.id != userId) return res.status(403).json([]);
    try {
        const result = await db.query(
            `SELECT t.id, t.title, t.status, t.assigned_at, u.email AS assigned_to
             FROM tasks t
             JOIN users u ON t.assigned_to = u.id
             WHERE t.assigned_by = $1`,
            [userId]
        );
        res.json(result.rows);
    } catch {
        res.status(500).json([]);
    }
});

// ===== GÖREV DURUMU GÜNCELLE =====
app.post("/update-task-status", auth, async (req, res) => {
    const { taskId, status } = req.body;
    try {
        const result = await db.query("SELECT assigned_to, title FROM tasks WHERE id=$1", [taskId]);
        if (!result.rows.length) return res.status(404).json({ message: "Görev bulunamadı" });

        const task = result.rows[0];
        if (req.user.role !== "student" || req.user.id != task.assigned_to)
            return res.status(403).json({ message: "Yetkiniz yok" });

        await db.query("UPDATE tasks SET status=$1 WHERE id=$2", [status, taskId]);

        // Parent'a mail gönder
        const parentResult = await db.query(
            "SELECT email FROM users WHERE id = (SELECT assigned_by FROM tasks WHERE id=$1)",
            [taskId]
        );
        if (parentResult.rows.length) {
            const parentEmail = parentResult.rows[0].email;
            await transporter.sendMail({
                from: `"Görev Takip" <${process.env.MAIL_USER}>`,
                to: parentEmail,
                subject: "Görev Durumu Güncellendi",
                text: `Öğrenciniz "${task.title}" görevini "${status}" olarak güncelledi.`
            });
        }

        res.json({ message: "Görev durumu güncellendi ve mail gönderildi" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Görev durumu güncellenemedi" });
    }
});

// ===== VELİ ÖĞRENCİ DAVET =====
app.get("/check-invite", async (req, res) => {
    try {
        const token = req.query.invite;

        if (!token) {
            return res.json({ valid: false });
        }

        const result = await db.query(
            "SELECT * FROM invite WHERE token=$1 AND used=false",
            [token]
        );

        if (result.rows.length === 0) {
            return res.json({ valid: false });
        }

        res.json({
            valid: true,
            email: result.rows[0].email
        });

    } catch (err) {
        console.error("CHECK INVITE ERROR:", err);
        res.status(500).json({ valid: false });
    }
});

app.post("/invite", auth, async (req, res) => {
    if (req.user.role !== "parent")
        return res.status(403).json({ message: "Yetkiniz yok" });

    const { email } = req.body;
    if (!email)
        return res.status(400).json({ message: "Email boş" });

    try {


        // Öğrenci kontrol"""
        const userCheck = await db.query(
            "SELECT id FROM users WHERE email=$1 AND role='student'",
            [email]
        );
        if (userCheck.rows.length)
            return res.status(400).json({ message: "Bu öğrenci zaten kayıtlı!" });

        const inviteCheck = await db.query(
            "SELECT id FROM invite WHERE email=$1 AND used=false",
            [email]
        );
        if (inviteCheck.rows.length)
            return res.status(400).json({ message: "Bu öğrenci zaten davet edilmiş!" });

        // Token oluştur
        const token = crypto.randomBytes(32).toString("hex");

        await db.query(
            "INSERT INTO invite (email, token) VALUES ($1, $2)",
            [email, token]
        );

        const inviteLink = `${FRONTEND_URL}/kayit.html?invite=${token}`;

       await transporter.sendMail({
            from: `"Görev Sistemi" <${process.env.MAIL_USER}>`,
            to: email,
            subject: "Görev Sistemine Davet Edildiniz",
            html: `
                <h2>Görev Sistemine Davet</h2>
                <p>Sizi görev sistemimize davet ettik.</p>
                <a href="${inviteLink}">Kayıt Ol</a>
                <p>Link çalışmazsa kopyalayın:</p>
                <p>${inviteLink}</p>
            `
        });

        res.json({ message: "Davet gönderildi!" });

    } catch (err) {
    console.error("INVITE ERROR FULL:", err);
    console.error("ERROR MESSAGE:", err?.message);
    console.error("ERROR STACK:", err?.stack);

    res.status(500).json({ 
        message: "Davet gönderilemedi",
        error: err?.message || "Bilinmeyen hata",
        fullError: err
    });
}
});


// ===== VELİ ÖĞRENCİ ID GETİR =====
app.get("/get-user-id", auth, async (req, res) => {
    const { email } = req.query;

    try {
        const result = await db.query(
            "SELECT id FROM users WHERE email=$1",
            [email]
        );

        if (!result.rows.length) {
            return res.json({ userId: null });
        }

        res.json({ userId: result.rows[0].id });

    } catch (err) {
        console.error(err);
        res.status(500).json({ userId: null });
    }
});

// ===== SERVER BAŞLAT =====
app.listen(process.env.PORT || 3000, () =>
    console.log(`Server çalışıyor → http://localhost:${process.env.PORT || 3000}`)
);
