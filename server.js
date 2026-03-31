process.env.TZ = "Europe/Istanbul";
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

async function sendMail(to, subject, htmlContent) {
    try {
        console.log("📧 Mail gönderimi başlatılıyor...");
        const response = await resend.emails.send({
            from: 'Sistem <onboarding@resend.dev>',
            to: 'keremacar3754is@gmail.com', // Kodlar her zaman senin mailine gidecek
            subject: subject,
            html: htmlContent
        });
        console.log("✅ Resend Yanıtı:", response);
    } catch (error) {
        console.error("❌ Resend API Hatası:", error);
        throw error; // Hatayı yukarı fırlat ki 500 hatası olarak terminale düşsün
    }
}

app.post("/send-code", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email gerekli" });
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        await db.query(`INSERT INTO users (email, code, verified, password, role) VALUES ($1, $2, false, '', 'student') ON CONFLICT (email) DO UPDATE SET code = $2, verified = false`, [email.trim(), code]);
        await sendMail(email.trim(), 'Doğrulama Kodunuz', `Kodunuz: ${code}`);
        res.json({ message: "Kod gönderildi" });
    } catch (error) { res.status(500).json({ message: "Hata" }); }
});

app.post("/verify-code", async (req, res) => {
    const { email, code } = req.body;
    try {
        const result = await db.query(
            "SELECT * FROM users WHERE email = $1 AND verification_code = $2",
            [email, code]
        );

        if (result.rows.length > 0) {
            await db.query(
                "UPDATE users SET is_verified = true, verification_code = NULL WHERE email = $1",
                [email]
            );
            res.json({ message: "Hesabınız doğrulandı!" });
        } else {
            res.status(400).json({ message: "Kod yanlış veya geçersiz." });
        }
    } catch (error) {
        res.status(500).json({ message: "Doğrulama hatası" });
    }
});
app.post("/set-password", async (req, res) => {
    const { email, password, role } = req.body;
    await db.query("UPDATE users SET password=$1, role=$2 WHERE email=$3 AND verified=true", [password, role, email]);
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
    res.status(401).json({ message: "Bilgiler hatalı" });
});

// server.js içindeki /add-task kısmını bulup bununla değiştirin
app.post("/add-task", auth, async (req, res) => {
    // Frontend'den gelen veri isimleriyle eşitledik: assignedToEmail
    const { title, description, assignedToEmail, dueDate, points, badge_reward } = req.body;

    try {
        // 1. Öğrenciyi email ile buluyoruz
        const studentRes = await db.query(
            "SELECT id FROM users WHERE email = $1 AND role = 'student'", 
            [assignedToEmail]
        );
        const student = studentRes.rows[0];

        if (!student) {
            return res.status(404).json({ message: "Öğrenci bulunamadı. Lütfen e-posta adresini kontrol edin." });
        }

        // 2. Görevi veritabanına kaydediyoruz
        // NOT: badge_reward'ın boş gelme ihtimaline karşı null kontrolü eklemek iyidir
        const newTask = await db.query(
            `INSERT INTO tasks 
            (title, description, assigned_to, assigned_by, due_date, points, badge_reward, status, updated_at) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'Baslamadi', NOW()) 
            RETURNING *`,
            [
                title, 
                description, 
                student.id, 
                req.user.id, 
                dueDate || null, 
                points || 0, 
                badge_reward || null
            ]
        );

        res.json({ 
            success: true,
            message: "Görev ve rozet başarıyla tanımlandı!", 
            task: newTask.rows[0] 
        });

    } catch (error) {
        console.error("Görev ekleme hatası:", error);
        res.status(500).json({ message: "Sunucu hatası: " + error.message });
    }
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
    
    try {
        // 1. Görevi bul
        const taskRes = await db.query("SELECT * FROM tasks WHERE id = $1", [taskId]);
        const task = taskRes.rows[0];

        if (!task) return res.status(404).json({ message: "Görev bulunamadı" });

        const oldStatus = task.status;
        const studentId = task.assigned_to;
        const taskPoints = parseInt(task.points) || 0;

        // 2. Durumu ve Tarihi Güncelle (Hata Buradaydı)
        await db.query(
            "UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2", 
            [status, taskId]
        );

        // 3. Puan İşlemleri
        if (status === "Tamamlandı" && oldStatus !== "Tamamlandı") {
            if (studentId) {
                await db.query(
                    `UPDATE users 
                     SET total_points = COALESCE(total_points, 0) + $1, 
                         current_balance = COALESCE(current_balance, 0) + $1 
                     WHERE id = $2`,
                    [taskPoints, studentId]
                );
            }
        }

        res.json({ message: "Başarıyla güncellendi." });

    } catch (error) {
        console.error("🔴 KRİTİK HATA:", error.message);
        res.status(500).json({ message: "Sunucu hatası: " + error.message });
    }
});
app.delete("/delete-task/:id", auth, async (req, res) => {
    await db.query("DELETE FROM tasks WHERE id = $1 AND assigned_by = $2", [req.params.id, req.user.id]);
    res.json({ message: "Silindi" });
});

app.post("/send-invite", auth, async (req, res) => {
    const { email } = req.body;
    const token = crypto.randomBytes(32).toString("hex");
    await db.query("INSERT INTO invite (email, token, used) VALUES ($1, $2, false)", [email, token]);
    const inviteLink = `${FRONTEND_URL}/kayit.html?invite=${token}`;
    await sendMail(email, "Davet", `<a href="${inviteLink}">Kayıt Ol</a>`);
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
// GÜNCELLENMİŞ PUAN GETİRME FONKSİYONU
app.get("/user-points/:userId", auth, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        // Sütun isimlerinin current_balance ve total_points olduğundan emin ol
        const result = await db.query("SELECT total_points, current_balance FROM users WHERE id = $1", [userId]);
        
        if (result.rows.length === 0) {
            return res.json({ total_points: 0, current_balance: 0 });
        }

        res.json({ 
            total_points: result.rows[0].total_points || 0,
            current_balance: result.rows[0].current_balance || 0 
        });
    } catch (error) {
        console.error("Puan çekme hatası:", error);
        res.status(500).json({ error: "Veritabanı hatası" });
    }
});
app.post("/buy-reward", auth, async (req, res) => {
    const { rewardName, cost } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email; // Token'dan gelen kullanıcı maili

    try {
        const userRes = await db.query("SELECT current_balance FROM users WHERE id = $1", [userId]);
        const balance = userRes.rows[0]?.current_balance || 0;

        if (balance < cost) {
            return res.status(400).json({ error: "Yetersiz bakiye." });
        }

        await db.query("UPDATE users SET current_balance = current_balance - $1 WHERE id = $2", [cost, userId]);
        
        await db.query(
            "INSERT INTO purchases (student_id, reward_name, cost, status) VALUES ($1, $2, $3, 'Bekliyor')",
            [userId, rewardName, cost]
        );

        // VELİYE MAİL GÖNDER (Kendi mailine bildirim)
        await sendMail(
            'keremacar3754is@gmail.com', 
            "🛒 Yeni Market Onay İsteği", 
            `<h3>Öğrenciniz Marketten Bir Ürün Aldı!</h3>
             <p><b>Öğrenci:</b> ${userEmail}</p>
             <p><b>Ürün:</b> ${rewardName}</p>
             <p><b>Maliyet:</b> ${cost} GP</p>
             <p>Lütfen onaylamak için veli paneline giriş yapın.</p>`
        );

        res.json({ message: "Satın alma başarılı ve veliye bildirildi!" });
    } catch (error) {
        console.error("❌ Satın alma hatası:", error.message);
        res.status(500).json({ error: "İşlem başarısız." });
    }
});
app.get("/pending-purchases/:parentId", auth, async (req, res) => {
    try {
        // Filtreyi genişlettik: Velinin maili ile eşleşen öğrencilerin bekleyen tüm alımlarını getir
        const result = await db.query(
            `SELECT p.*, u.email as student_email 
             FROM purchases p 
             JOIN users u ON p.student_id = u.id 
             WHERE p.status = 'Bekliyor'`, []
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Market hatası:", error);
        res.status(500).json({ message: "Hata oluştu" });
    }
});
app.post("/update-purchase-status", auth, async (req, res) => {
    const { purchaseId, status, reason } = req.body;

    try {
        // 1. Durumu ve (varsa) açıklamayı güncelle
        // COALESCE(rejection_reason, $2) gibi karmaşık yapılar yerine direkt güncelleme:
        await db.query(
            "UPDATE purchases SET status = $1, rejection_reason = $2 WHERE id = $3",
            [status, reason || null, purchaseId]
        );

        // 2. Eğer reddedildiyse GP iadesi yap
        if (status === "Reddedildi") {
            const purchaseRes = await db.query("SELECT student_id, cost FROM purchases WHERE id = $1", [purchaseId]);
            if (purchaseRes.rows.length > 0) {
                const { student_id, cost } = purchaseRes.rows[0];
                await db.query(
                    "UPDATE users SET current_balance = current_balance + $1 WHERE id = $2",
                    [cost, student_id]
                );
            }
        }

        res.json({ message: "İşlem başarılı" });
    } catch (error) {
        console.error("Update Purchase Status Error:", error);
        res.status(500).json({ message: "Sunucu hatası: " + error.message });
    }
});
app.post("/archive-task-parent", auth, async (req, res) => {
    const { taskId } = req.body;
    try {
        // Görevi silmiyoruz, sadece veli için 'arşivlendi' olarak işaretliyoruz
        await db.query("UPDATE tasks SET archived_by_parent = TRUE WHERE id = $1", [taskId]);
        res.json({ message: "Görev veli listesinden kaldırıldı, ancak öğrenci arşivinde saklanıyor." });
    } catch (error) {
        res.status(500).json({ message: "Hata oluştu." });
    }
}); 
app.post("/checkout", auth, async (req, res) => {
    const { userId, items, totalCost } = req.body;
    
    try {
        const userRes = await db.query("SELECT current_balance, email FROM users WHERE id = $1", [userId]);
        const currentBalance = userRes.rows[0].current_balance;
        const studentEmail = userRes.rows[0].email;

        if (currentBalance < totalCost) {
            return res.status(400).json({ message: "Yetersiz bakiye!" });
        }

        await db.query("UPDATE users SET current_balance = current_balance - $1 WHERE id = $2", [totalCost, userId]);
        
        let itemsHtml = "";
        for (const item of items) {
            await db.query(
                "INSERT INTO purchases (student_id, reward_name, cost, status) VALUES ($1, $2, $3, 'Bekliyor')",
                [userId, item.rewardName, item.cost]
            );
            itemsHtml += `<li>${item.rewardName} (${item.cost} GP)</li>`;
        }

        // VELİYE TOPLU MAİL
        await sendMail(
            'keremacar3754is@gmail.com', 
            "🛒 Yeni Sepet Onay İsteği", 
            `<h3>Öğrenciniz Sepetini Onayladı!</h3>
             <p><b>Öğrenci:</b> ${studentEmail}</p>
             <ul>${itemsHtml}</ul>
             <p><b>Toplam Tutar:</b> ${totalCost} GP</p>`
        );

        res.json({ message: "Sepet başarıyla gönderildi ve veliye bildirildi!" });
    } catch (error) {
        res.status(500).json({ message: "Sunucu hatası" });
    }
});
app.get("/rejected-purchases/:userId", auth, async (req, res) => {
    try {
        const result = await db.query(
            "SELECT id, reward_name, cost, rejection_reason FROM purchases WHERE student_id = $1 AND status = 'Reddedildi' ORDER BY id DESC", 
            [req.params.userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Hata:", error);
        res.status(500).json({ message: "Hata" });
    }
});
app.post("/clear-rejected-purchase", auth, async (req, res) => {
    const { purchaseId } = req.body;
    try {
        // Reddedilen kaydı tamamen silebiliriz veya durumunu 'Görüldü' yapabiliriz. 
        // Burada siliyoruz ki liste kalabalıklaşmasın.
        await db.query("DELETE FROM purchases WHERE id = $1 AND status = 'Reddedildi'", [purchaseId]);
        res.json({ message: "Bildirim temizlendi." });
    } catch (error) {
        res.status(500).json({ message: "Temizleme hatası" });
    }
});
app.delete("/clear-rejected-purchase/:id", auth, async (req, res) => {
    try {
        await db.query("DELETE FROM purchases WHERE id = $1 AND status = 'Reddedildi'", [req.params.id]);
        res.json({ message: "Silindi" });
    } catch (error) {
        res.status(500).json({ message: "Hata" });
    }
});
// ÖĞRENCİ İSTATİSTİKLERİNİ GETİR (Grafik + Detaylı Liste)
app.get("/user-stats/:userId", auth, async (req, res) => {
    try {
        const { userId } = req.params;

        // 1. Grafik Verisi (Son 7 gün)
        const chartData = await db.query(`
            SELECT TO_CHAR(updated_at, 'DD Mon') as gun, COUNT(*) as miktar
            FROM tasks 
            WHERE assigned_to = $1 AND status = 'Tamamlandı' AND updated_at >= NOW() - INTERVAL '7 days'
            GROUP BY gun, DATE(updated_at) ORDER BY DATE(updated_at) ASC
        `, [userId]);

        // 2. Detaylı Görev Listesi (Hangi görev, ne zaman?)
        const taskDetails = await db.query(`
            SELECT title, updated_at, points
            FROM tasks 
            WHERE assigned_to = $1 AND status = 'Tamamlandı'
            ORDER BY updated_at DESC LIMIT 15
        `, [userId]);

        res.json({
            labels: chartData.rows.map(r => r.gun),
            values: chartData.rows.map(r => r.miktar),
            details: taskDetails.rows // Frontend bu 'details'ı kullanacak
        });
    } catch (error) {
        console.error("Stats Hatası:", error);
        res.status(500).json({ message: "İstatistikler yüklenemedi" });
    }
});
app.get("/get-student-id", auth, async (req, res) => {
    const { email } = req.query;
    try {
        const result = await db.query("SELECT id FROM users WHERE email = $1 AND role = 'student'", [email]);
        if (result.rows.length > 0) {
            res.json({ studentId: result.rows[0].id });
        } else {
            res.status(404).json({ message: "Öğrenci bulunamadı" });
        }
    } catch (error) {
        res.status(500).json({ message: "Sunucu hatası" });
    }
});
app.post("/register", async (req, res) => {
    const { email, password, role } = req.body; // 'name' kaldırıldı
    try {
        console.log(`🚀 Kayıt denemesi (Sadece Mail): ${email}`);

        // 1. Kullanıcı var mı?
        const userExists = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: "Bu e-posta zaten kayıtlı." });
        }

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        // 2. DB'ye kaydet (Sorgudan 'name' sütunu ve $1 parametresi çıkarıldı)
        await db.query(
            "INSERT INTO users (email, password, role, is_verified, verification_code) VALUES ($1, $2, $3, false, $4)",
            [email, password, role, verificationCode]
        );

        // 3. Mail Gönder (Senin mailine)
        await sendMail(
            'keremacar3754is@gmail.com', 
            "Yeni Kayıt Bildirimi", 
            `<h3>Yeni bir kullanıcı kayıt olmak istiyor!</h3>
             <p>E-posta: <b>${email}</b></p>
             <p>Rol: <b>${role}</b></p>
             <p>Doğrulama Kodu: <b style="font-size:20px; color:red;">${verificationCode}</b></p>`
        );

        res.json({ message: "Doğrulama kodu Kerem'in mailine gönderildi!" });
    } catch (error) {
        console.error("🔴 KRİTİK HATA:", error.message);
        res.status(500).json({ message: "Sunucu hatası: " + error.message });
    }
});
app.get("/get-user-by-email", auth, async (req, res) => {
    const { email } = req.query;
    try {
        const result = await db.query("SELECT id FROM users WHERE email = $1", [email]);
        if (result.rows.length > 0) {
            res.json({ id: result.rows[0].id });
        } else {
            res.status(404).json({ message: "Öğrenci bulunamadı" });
        }
    } catch (error) {
        console.error("Sorgu hatası:", error);
        res.status(500).json({ message: "Sunucu hatası" });
    }
});
app.get("/my-badges/:userId", auth, async (req, res) => {
    const { userId } = req.params;
    try {
        // DISTINCT yerine COUNT ve GROUP BY kullanarak her rozetten kaç tane olduğunu buluyoruz
        const result = await db.query(
            `SELECT badge_reward, COUNT(*) as count 
             FROM tasks 
             WHERE assigned_to = $1 AND status = 'Tamamlandı' 
             AND badge_reward IS NOT NULL AND badge_reward != ''
             GROUP BY badge_reward`,
            [userId]
        );
        
        res.json(result.rows); // Artık [{badge_reward: 'Kitap Kurdu', count: 3}, ...] dönecek
    } catch (error) {
        console.error("Rozetler getirilirken hata:", error);
        res.status(500).json({ message: "Sunucu hatası" });
    }
});
app.get("/pending-purchases", auth, async (req, res) => {
    try {
        // Sadece 'Bekliyor' durumundaki satın almaları getir
        const result = await db.query(
            "SELECT * FROM purchases WHERE status = 'Bekliyor' ORDER BY created_at DESC"
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Market listesi hatası:", error);
        res.status(500).json({ message: "Sunucu hatası" });
    }
});
app.listen(process.env.PORT || 3000, () => console.log("Sistem Aktif"));