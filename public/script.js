// -------------------- GENEL AYARLAR & AUTH --------------------
function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}

// API isteklerinde kullanılan yardımcı fonksiyon (Token kontrolü için)
function getAuthHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + localStorage.getItem("token")
    };
}

// -------------------- ÖĞRENCİ FONKSİYONLARI --------------------
function loadMyTasks() {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    fetch(`/my-tasks/${userId}`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(tasks => {
        const list = document.getElementById("taskList");
        if (!list) return;
        list.innerHTML = "";

        if (tasks.length === 0) {
            list.innerHTML = "<li>Henüz görev atanmamış.</li>";
            return;
        }

        tasks.forEach(task => {
            const li = document.createElement("li");
            const dueDate = task.due_date ? new Date(task.due_date) : null;
            const isOverdue = dueDate && dueDate < new Date() && task.status !== 'Tamamlandı';
            
            li.style = `border-left: 5px solid ${isOverdue ? '#e53e3e' : '#48bb78'}; background: ${isOverdue ? '#fff5f5' : '#fff'}; padding: 15px; margin-bottom: 10px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); list-style:none;`;
            
            li.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <b style="font-size:1.1em;">${task.title}</b><br>
                        <small>Atayan: ${task.assigned_by}</small><br>
                        <span style="color: ${isOverdue ? 'red' : '#666'}; font-weight: ${isOverdue ? 'bold' : 'normal'}">
                            ⏳ Son Teslim: ${dueDate ? dueDate.toLocaleString("tr-TR") : 'Belirtilmedi'}
                        </span>
                    </div>
                    <div>
                        <select onchange="updateStatus(${task.id}, this.value)" style="padding:5px; border-radius:4px;">
                            <option value="Başlamadı" ${task.status === 'Başlamadı' ? 'selected' : ''}>🔴 Başlamadı</option>
                            <option value="Başlandı" ${task.status === 'Başlandı' ? 'selected' : ''}>🔵 Başlandı</option>
                            <option value="Devam Ediyor" ${task.status === 'Devam Ediyor' ? 'selected' : ''}>🟡 Devam Ediyor</option>
                            <option value="Tamamlandı" ${task.status === 'Tamamlandı' ? 'selected' : ''}>🟢 Tamamlandı</option>
                        </select>
                    </div>
                </div>
            `;
            list.appendChild(li);
        });
    });
}

function updateStatus(taskId, status) {
    fetch("/update-task-status", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ taskId, status })
    }).then(res => {
        if (res.ok) {
            alert("Durum güncellendi!");
            loadMyTasks();
        }
    });
}

// -------------------- VELİ FONKSİYONLARI (KANBAN) --------------------
function loadMyAssignedTasks() {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    fetch(`/my-assigned-tasks/${userId}`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(tasks => {
        const columns = ["Baslamadi", "Baslandi", "DevamEdiyor", "Tamamlandi"];
        const counts = { Baslamadi: 0, Baslandi: 0, DevamEdiyor: 0, Tamamlandi: 0 };
        
        const overduePanel = document.getElementById("overdue-panel");
        const overdueList = document.getElementById("overdue-list");
        if (overdueList) overdueList.innerHTML = "";
        let overdueCount = 0;

        // Kolonları temizle
        columns.forEach(id => {
            const el = document.getElementById(`parent-list-${id}`);
            if (el) el.innerHTML = "";
        });

        tasks.forEach(task => {
            const dueDate = task.due_date ? new Date(task.due_date) : null;
            const isOverdue = dueDate && dueDate < new Date() && task.status !== "Tamamlandı";
            const dateStr = dueDate ? dueDate.toLocaleString("tr-TR") : "Belirtilmedi";

            // Gecikenler paneli
            if (isOverdue) {
                overdueCount++;
                const li = document.createElement("li");
                li.innerHTML = `⚠️ <b>${task.title}</b> - <small>${task.assigned_to} (${dateStr})</small>`;
                if (overdueList) overdueList.appendChild(li);
            }

            // Kanban kartı
            let statusKey = task.status.replace(/\s/g, ''); 
            if (statusKey === "Başlamadı") statusKey = "Baslamadi";
            if (statusKey === "Başlandı") statusKey = "Baslandi";

            if (counts.hasOwnProperty(statusKey)) {
                counts[statusKey]++;
                const container = document.getElementById(`parent-list-${statusKey}`);
                if (container) {
                    const card = document.createElement("div");
                    card.style = `background:#fff; border:1px solid ${isOverdue ? '#fc8181' : '#eee'}; padding:12px; margin-bottom:10px; border-radius:8px; position:relative; box-shadow:0 2px 4px rgba(0,0,0,0.05);`;
                    card.innerHTML = `
                        <div style="padding-right:25px;">
                            <b style="color:${isOverdue ? '#c53030' : '#333'}">${isOverdue ? '⏳ ' : ''}${task.title}</b><br>
                            <small>👤 ${task.assigned_to}</small><br>
                            <small>📅 ${dateStr}</small>
                        </div>
                        <button onclick="deleteTask(${task.id})" style="position:absolute; top:8px; right:8px; border:none; background:none; cursor:pointer; font-size:16px;">🗑️</button>
                    `;
                    container.appendChild(card);
                }
            }
        });

        // Sayacı güncelle
        columns.forEach(id => {
            const countEl = document.getElementById(`count-${id}`);
            if (countEl) countEl.innerText = counts[id];
        });

        if (overduePanel) overduePanel.style.display = overdueCount > 0 ? "block" : "none";
    });
}

function addTask() {
    const title = document.getElementById("taskTitle").value;
    const email = document.getElementById("assignedToEmail").value;
    const dueDate = document.getElementById("dueDate").value;
    const dueTime = document.getElementById("dueTime").value;

    if (!title || !email) return alert("Başlık ve Öğrenci Maili zorunludur!");

    fetch(`/get-user-id?email=${email}`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(data => {
        if (!data.userId) return alert("Bu mail adresine sahip bir öğrenci bulunamadı!");

        let finalDateTime = null;
        if (dueDate && dueTime) finalDateTime = new Date(`${dueDate}T${dueTime}`).toISOString();
        else if (dueDate) finalDateTime = dueDate;

        fetch("/add-task", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                title: title,
                assignedBy: localStorage.getItem("userId"),
                assignedTo: data.userId,
                due_date: finalDateTime
            })
        }).then(res => {
            if (res.ok) {
                alert("Görev başarıyla eklendi!");
                location.reload();
            }
        });
    });
}

function deleteTask(taskId) {
    if (!confirm("Bu görevi silmek istediğinize emin misiniz?")) return;
    fetch(`/delete-task/${taskId}`, { method: "DELETE", headers: getAuthHeaders() })
    .then(() => loadMyAssignedTasks());
}

// -------------------- KAYIT, GİRİŞ & DAVET --------------------
function sendInvite() {
    const email = document.getElementById("inviteEmail").value.trim();
    if (!email) return alert("Mail adresi girin!");

    fetch("/send-invite", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ email })
    }).then(res => res.ok ? alert("Davet gönderildi!") : alert("Hata oluştu!"));
}

// script.js içindeki sendCode fonksiyonunu bununla değiştir
function sendCode() {
    const emailInput = document.getElementById("email");
    const email = emailInput ? emailInput.value.trim() : "";
    
    if (!email) {
        return alert("Lütfen geçerli bir mail adresi giriniz!");
    }

    // Butonu geçici olarak devre dışı bırakalım (Yanlışlıkla iki kez basılmasın)
    const btn = document.querySelector("button[onclick='sendCode()']");
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Gönderiliyor...";
    }

    fetch("/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Kodu Yeniden Gönder";
        }
    })
    .catch(err => {
        console.error("Kod gönderme hatası:", err);
        alert("Kod gönderilemedi, lütfen internetinizi kontrol edin.");
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Tekrar Dene";
        }
    });
}

function verify() {
    const email = document.getElementById("email").value.trim();
    const code = document.getElementById("code").value.trim();
    const password = document.getElementById("password").value.trim();
    
    // Sayfa yüklendiğinde belirlenen rolü al (Öğrenci veya Veli)
    const role = localStorage.getItem("registerRole") || "parent";

    if (!email || !code || !password) {
        return alert("Lütfen tüm alanları (Email, Kod ve Şifre) doldurunuz!");
    }

    // 1. Adım: Kodu doğrula
    fetch("/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
    })
    .then(res => res.json())
    .then(data => {
        if (data.message === "Kod doğrulandı") {
            // 2. Adım: Kod doğruysa şifreyi ve rolü kaydet
            return fetch("/set-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, role })
            });
        } else {
            throw new Error(data.message); // Kod hatalıysa durdur
        }
    })
    .then(res => res.json())
    .then(data => {
        alert("Kayıt işleminiz başarıyla tamamlandı! Şimdi giriş yapabilirsiniz.");
        window.location.href = "index.html"; // Giriş sayfasına yönlendir
    })
    .catch(err => {
        alert("Hata: " + err.message);
        console.error("Doğrulama hatası:", err);
    });
}

function setPassword() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const role = localStorage.getItem("registerRole") || "parent";
    fetch("/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role })
    }).then(res => res.json()).then(data => {
        alert("Kayıt Başarılı!");
        window.location.href = "index.html";
    });
}

function login() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const role = localStorage.getItem("loginRole");

    fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role })
    }).then(res => res.json()).then(data => {
        if (data.token) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("userId", data.userId);
            localStorage.setItem("role", data.role);
            window.location.href = data.role.toLowerCase() === "parent" ? "veli-dashboard.html" : "dashboard.html";
        } else {
            alert(data.message);
        }
    });
}

// -------------------- SAYFA YÜKLENDİĞİNDE --------------------
// script.js içindeki DOMContentLoaded kısmını bu şekilde güncelle:

document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get("invite");
    const emailInput = document.getElementById("email");
    const roleText = document.getElementById("roleText");

    // Varsayılan rol (Eğer davet linki yoksa)
    if (!inviteToken) {
        localStorage.setItem("registerRole", "parent");
        if (roleText) roleText.innerText = "Veli";
    }

    // Davet linki kontrolü
    if (inviteToken && emailInput) {
        fetch(`/check-invite?invite=${inviteToken}`)
        .then(res => res.json())
        .then(data => {
            if (data.valid) {
                // 1. Maili doldur (Yazılabilir halde bırak)
                emailInput.value = data.email;
                emailInput.readOnly = false; // Kullanıcı isterse değiştirebilir
                
                // 2. Rolü ÖĞRENCİ yap ve ekranda göster
                localStorage.setItem("registerRole", "student");
                if (roleText) {
                    roleText.innerText = "Öğrenci (Davetli)";
                    roleText.style.color = "#48bb78"; // Yeşil renk
                }
            } else {
                if (roleText) roleText.innerText = "Geçersiz Davet!";
                alert("Davet linki geçersiz.");
            }
        })
        .catch(err => {
            console.error("Hata:", err);
            if (roleText) roleText.innerText = "Bağlantı Hatası!";
        });
    }
});