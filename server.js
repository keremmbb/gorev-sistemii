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

// 1. AUTH FONKSİYONU BURADA OLMALI
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

// Mail Fonksiyonu
// server.js dosyanın en üstünde mail adresini bir değişkene al
const MY_VERIFIED_EMAIL = 'keremacar3754is@gmail.com'; 

// server.js içindeki sendMail fonksiyonunu bununla değiştir:
async function sendMail(to, subject, html) {
    try {
        const response = await resend.emails.send({
            from: 'onboarding@resend.dev',
            // BURAYI DEĞİŞTİR: Hata mesajındaki maili aynen kopyala
            to: 'keremacar3754is@gmail.com', 
            subject: subject,
            html: `
                <p><strong>Asıl Alıcı:</strong> ${to}</p>
                <hr>
                ${html}
            `
        });
        console.log("Resend Başarılı:", response);
        return response;
    } catch (error) {
        console.error("Resend Hatası:", error);
        throw error;
    }
}
// ===== AUTH & ROUTES =====
// (Diğer tüm rotaların /verify-code, /login vb. aynı kalacak)

app.post("/send-code", async (req, res) => {
    const { email } = req.body; // Kullanıcının ekrana yazdığı mail
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    try {
        // Veritabanına kullanıcının yazdığı maili ve kodu kaydediyoruz
        await db.query(`INSERT INTO users (email, code, verified, password, role) 
                        VALUES ($1, $2, false, '', 'pending') 
                        ON CONFLICT (email) DO UPDATE SET code = $2, verified = false`, [email, code]);
        
        // DİKKAT: Buradaki 'email' değişkeni yerine kendi mailini tırnak içinde yazıyoruz
        await sendMail('keremacar3757@gmail.com', 'Ödev Doğrulama Kodunuz', `<p>Kayıt olmaya çalışan adres: <strong>${email}</strong></p><p>Doğrulama kodunuz: <strong>${code}</strong></p>`);
        
        console.log(`Kod ${email} için oluşturuldu ama keremacar3757@gmail.com adresine gönderildi.`);
        res.json({ message: "Kod gönderildi" });
    } catch (error) { 
        console.error("API HATASI:", error);
        res.status(500).json({ message: "Mail gönderilemedi" }); 
    }
});

// ... diğer rotalar ...



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

    
app.post("/set-password", async (req, res) => {
    const { email, password, role } = req.body;
    
    // Debug için log ekleyelim, terminalde ne geldiğini görelim
    console.log("Şifre belirleme isteği geldi:", { email, role });

    try {
        // Kullanıcıyı güncelle
        const result = await db.query(
            `UPDATE users SET password = $1, role = $2 WHERE email = $3 AND verified = true`, 
            [password, role, email]
        );

        if (result.rowCount === 0) {
            return res.status(400).json({ message: "Kullanıcı bulunamadı veya kod doğrulanmadı!" });
        }

        res.json({ message: "Şifre başarıyla kaydedildi" });
    } catch (err) {
        console.error("SET PASSWORD HATASI:", err);
        res.status(500).json({ message: "Sunucu hatası: " + err.message });
    }
});


// ===== LOGIN =====
// server.js içindeki LOGIN kısmını bununla DEĞİŞTİR
app.post("/login", async (req, res) => {
    // Gelen verileri temizleyelim (trim)
    const email = req.body.email ? req.body.email.trim() : "";
    const password = req.body.password;
    const role = req.body.role ? req.body.role.trim().toLowerCase() : "";

    try {
        // 1. Kullanıcıyı bul
        const result = await db.query(
            "SELECT id, password, verified, role FROM users WHERE email ILIKE $1", 
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Kullanıcı bulunamadı" });
        }

        const user = result.rows[0];

        // 2. Şifre kontrolü
        if (user.password !== password) {
            return res.status(401).json({ message: "Şifre hatalı" });
        }

        // 3. Doğrulama kontrolü
        if (!user.verified) {
            return res.status(401).json({ message: "Hesap doğrulanmamış" });
        }

        // 4. Rol kontrolü (En kritik yer)
        const userRole = user.role ? user.role.trim().toLowerCase() : "";
        if (userRole !== role) {
            return res.status(403).json({ message: `Rol uyuşmazlığı! Sistemdeki rolünüz: ${userRole}` });
        }
        
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });
        res.json({ token, userId: user.id, role: user.role, message: "Giriş başarılı" }); // "Giriş başarılı" mesajını ekledik
    } catch (err) {
        console.error("Login Hatası:", err);
        res.status(500).json({ message: "Sunucu hatası" });
    }
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
        // 1. Görevi ve bu görevi atayan velinin bilgilerini çekelim
        const taskResult = await db.query(`
            SELECT t.title, u.email as parent_email, u.id as parent_id 
            FROM tasks t 
            JOIN users u ON t.assigned_by = u.id 
            WHERE t.id = $1`, [taskId]);

        const task = taskResult.rows[0];

        if (!task) {
            return res.status(404).json({ message: "Görev bulunamadı" });
        }

        // 2. Durumu güncelleyelim
        await db.query("UPDATE tasks SET status = $1 WHERE id = $2", [status, taskId]);

        // 3. EĞER durum "Tamamlandı" ise veliye mail atalım
        if (status === "Tamamlandı") {
            await sendMail(task.parent_email, "Görev Tamamlandı! ✅", `
                <div style="font-family: sans-serif; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #2e7d32;">Güzel Haber!</h2>
                    <p>Öğrenciniz bir görevi başarıyla tamamladı.</p>
                    <hr>
                    <p><strong>Tamamlanan Görev:</strong> ${task.title}</p>
                    <p><strong>Durum:</strong> <span style="background: #e8f5e9; color: #2e7d32; padding: 3px 8px; border-radius: 4px;">Tamamlandı</span></p>
                    <br>
                    <p>Detayları görmek için sisteme giriş yapabilirsiniz.</p>
                </div>
            `);
            console.log(`Tamamlandı bildirimi ${task.parent_email} adresine gönderildi.`);
        }

        res.json({ message: "Durum güncellendi ve veliye bilgi verildi." });
    } catch (err) {
        console.error("Durum Güncelleme Hatası:", err);
        res.status(500).json({ message: "Hata oluştu" });
    }
});

// ===== DAVET İŞLEMLERİ =====
app.get("/check-invite", async (req, res) => {
    const result = await db.query("SELECT email FROM invite WHERE token=$1 AND used=false", [req.query.invite]);
    res.json(result.rows.length ? { valid: true, email: result.rows[0].email } : { valid: false });
});

// server.js içindeki app.post("/invite", ...) kısmını bununla güncelle
app.post("/invite", auth, async (req, res) => {
    if (req.user.role !== "parent") return res.status(403).json({ message: "Yetkisiz" });
    
    const { email } = req.body; 
    const token = crypto.randomBytes(32).toString("hex");

    try {
        await db.query("INSERT INTO invite (email, token, used) VALUES ($1, $2, false)", [email, token]);

        // Linki oluşturuyoruz
        const inviteLink = `${FRONTEND_URL}/kayit.html?invite=${token}`;

        // Sadece linkin gittiği temiz mail içeriği
        await sendMail(email, "Kayıt Davetiyesi", `
            <div style="font-family: sans-serif; text-align: center; padding: 20px;">
                <h2>Giriş Yapmak İçin Davet Edildiniz</h2>
                <p>Aşağıdaki bağlantıya tıklayarak kaydınızı tamamlayabilirsiniz:</p>
                <br>
                <a href="${inviteLink}" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Kaydı Tamamla
                </a>
                <br><br>
                <p>Veya bu linki tarayıcınıza yapıştırın:</p>
                <p style="color: #666;">${inviteLink}</p>
            </div>
        `);

        res.json({ message: "Davet linki başarıyla gönderildi!" });
    } catch (err) {
        console.error("Davet Hatası:", err);
        res.status(500).json({ message: "Hata oluştu." });
    }
});

app.get("/get-user-id", auth, async (req, res) => {
    const result = await db.query("SELECT id FROM users WHERE email=$1", [req.query.email]);
    res.json({ userId: result.rows[0]?.id || null });
});
// server.js içine eklenecek silme rotası
app.delete("/delete-task/:id", auth, async (req, res) => {
    const taskId = req.params.id;
    const userId = req.user.id;

    try {
        // Güvenlik kontrolü: Sadece görevi atayan kişi silebilir
        const result = await db.query(
            "DELETE FROM tasks WHERE id = $1 AND assigned_by = $2", 
            [taskId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(403).json({ message: "Bu görevi silme yetkiniz yok veya görev bulunamadı." });
        }

        res.json({ message: "Görev başarıyla silindi" });
    } catch (err) {
        console.error("Silme Hatası:", err);
        res.status(500).json({ message: "Görev silinirken hata oluştu" });
    }
});
app.listen(process.env.PORT || 3000, () => console.log("Server çalışıyor"));