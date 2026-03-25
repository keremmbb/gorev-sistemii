// -------------------- GENEL AYARLAR & AUTH --------------------
function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}

function getAuthHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + localStorage.getItem("token")
    };
}

// -------------------- ÖĞRENCİ FONKSİYONLARI --------------------
async function loadMyTasks() {
    const res = await fetch("/tasks", {
        headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    });
    const tasks = await res.json();
    const taskList = document.getElementById("taskList");
    taskList.innerHTML = "";

    tasks.forEach(task => {
        // --- SAAT DÜZELTME KODU BAŞLANGICI ---
        const tarihObjesi = new Date(task.task_date);
        const temizSaat = tarihObjesi.toLocaleTimeString('tr-TR', { 
            timeZone: 'Europe/Istanbul', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        // --- SAAT DÜZELTME KODU BİTİŞİ ---

        const li = document.createElement("li");
        li.style = "background: white; margin-bottom: 15px; padding: 15px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-left: 5px solid #4CAF50;";
        li.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="font-size: 1.1rem; color: #2c3e50;">${task.title}</strong><br>
                    <small style="color: #7f8c8d;">${task.description}</small><br>
                    <span style="color: #e67e22; font-weight: bold;">⏰ Saat: ${temizSaat}</span> | 
                    <span style="color: #27ae60; font-weight: bold;">💎 ${task.points} Puan</span>
                </div>
                <button onclick="completeTask(${task.id})" style="background: #4CAF50; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold;">Tamamla</button>
            </div>
        `;
        taskList.appendChild(li);
    });
}

// --- VELİ TARAFI GÜNCELLEME ---
function loadMyAssignedTasks() {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    fetch(`/my-assigned-tasks/${userId}`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(tasks => {
        const columns = ["Baslamadi", "Baslandi", "DevamEdiyor", "Tamamlandi"];
        const counts = { Baslamadi: 0, Baslandi: 0, DevamEdiyor: 0, Tamamlandi: 0 };
        
        const overdueList = document.getElementById("overdue-list");
        if (overdueList) overdueList.innerHTML = "";
        let overdueCount = 0;

        columns.forEach(id => {
            const el = document.getElementById(`parent-list-${id}`);
            if (el) el.innerHTML = "";
        });

        tasks.forEach(task => {
            // DÜZELTME BURADA: fixDate kullanıyoruz
            const dateStr = fixDate(task.due_date);
            const dueDateObj = new Date(task.due_date);
            const isOverdue = dueDateObj < new Date() && task.status !== "Tamamlandı";

            if (isOverdue) {
                overdueCount++;
                const li = document.createElement("li");
                li.innerHTML = `⚠️ <b>${task.title}</b> - <small>${task.assigned_to} (${dateStr})</small>`;
                if (overdueList) overdueList.appendChild(li);
            }

            let statusKey = task.status;
            if (statusKey === "Başlamadı") statusKey = "Baslamadi";
            else if (statusKey === "Başlandı") statusKey = "Baslandi";
            else if (statusKey === "Devam Ediyor") statusKey = "DevamEdiyor";
            else if (statusKey === "Tamamlandı") statusKey = "Tamamlandi";

            if (counts.hasOwnProperty(statusKey)) {
                counts[statusKey]++;
                const container = document.getElementById(`parent-list-${statusKey}`);
                if (container) {
                    const card = document.createElement("div");
                    card.style = `background:#fff; border:1px solid ${isOverdue ? '#fc8181' : '#eee'}; padding:12px; margin-bottom:10px; border-radius:8px; position:relative; box-shadow:0 2px 4px rgba(0,0,0,0.05);`;
                    
                    card.innerHTML = `
                        <div style="padding-right:25px;">
                            <b style="color:${isOverdue ? '#c53030' : '#333'}">${isOverdue ? '⏳ ' : ''}${task.title}</b>
                            <span style="font-size:0.8em; color:#92400e; font-weight:bold;"> (🏆 ${task.points} Puan)</span><br>
                            <p style="color: #666; font-size: 0.85em; margin: 5px 0; font-style: italic;">${task.description || ""}</p>
                            <small style="display:block; margin-top:5px;">👤 Öğrenci: ${task.assigned_to}</small>
                            <small style="color:#999;">📅 ${dateStr}</small>
                        </div>
                        <button onclick="deleteTask(${task.id})" style="position:absolute; top:8px; right:8px; border:none; background:none; cursor:pointer; font-size:16px;">🗑️</button>
                    `;
                    container.appendChild(card);
                }
            }
        });

        columns.forEach(id => {
            const countEl = document.getElementById(`count-${id}`);
            if (countEl) countEl.innerText = counts[id];
        });

        const overduePanel = document.getElementById("overdue-panel");
        if (overduePanel) overduePanel.style.display = overdueCount > 0 ? "block" : "none";
    });
}

async function loadStudentPoints() {
    const userId = localStorage.getItem("userId");
    const token = localStorage.getItem("token");
    if (!userId || !token) return;

    try {
        const response = await fetch(`/user-points/${userId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await response.json();
        const pointsDisplay = document.getElementById("total-points");
        if (pointsDisplay) pointsDisplay.innerText = data.total_points || 0;
    } catch (error) { console.error("Puan yükleme hatası:", error); }
}

function updateStatus(taskId, status) {
    fetch("/update-task-status", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ taskId, status })
    }).then(res => {
        if (res.ok) {
            loadMyTasks();
            loadStudentPoints(); 
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

        columns.forEach(id => {
            const el = document.getElementById(`parent-list-${id}`);
            if (el) el.innerHTML = "";
        });

        tasks.forEach(task => {
            const dueDate = task.due_date ? new Date(task.due_date) : null;
            const dateStr = dueDate ? dueDate.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : "Belirtilmedi";
            const isOverdue = dueDate && dueDate < new Date() && task.status !== "Tamamlandı";

            if (isOverdue) {
                overdueCount++;
                const li = document.createElement("li");
                li.innerHTML = `⚠️ <b>${task.title}</b> - <small>${task.assigned_to} (${dateStr})</small>`;
                if (overdueList) overdueList.appendChild(li);
            }

            let statusKey = task.status;
            if (statusKey === "Başlamadı") statusKey = "Baslamadi";
            else if (statusKey === "Başlandı") statusKey = "Baslandi";
            else if (statusKey === "Devam Ediyor") statusKey = "DevamEdiyor";
            else if (statusKey === "Tamamlandı") statusKey = "Tamamlandi";

            if (counts.hasOwnProperty(statusKey)) {
                counts[statusKey]++;
                const container = document.getElementById(`parent-list-${statusKey}`);
                if (container) {
                    const card = document.createElement("div");
                    card.style = `background:#fff; border:1px solid ${isOverdue ? '#fc8181' : '#eee'}; padding:12px; margin-bottom:10px; border-radius:8px; position:relative; box-shadow:0 2px 4px rgba(0,0,0,0.05);`;
                    
                    card.innerHTML = `
                        <div style="padding-right:25px;">
                            <b style="color:${isOverdue ? '#c53030' : '#333'}">${isOverdue ? '⏳ ' : ''}${task.title}</b>
                            <span style="font-size:0.8em; color:#92400e; font-weight:bold;"> (🏆 ${task.points} Puan)</span><br>
                            <p style="color: #666; font-size: 0.85em; margin: 5px 0; font-style: italic;">${task.description || ""}</p>
                            <small style="display:block; margin-top:5px;">👤 Öğrenci: ${task.assigned_to}</small>
                            <small style="color:#999;">📅 ${dateStr}</small>
                        </div>
                        <button onclick="deleteTask(${task.id})" style="position:absolute; top:8px; right:8px; border:none; background:none; cursor:pointer; font-size:16px;">🗑️</button>
                    `;
                    container.appendChild(card);
                }
            }
        });

        columns.forEach(id => {
            const countEl = document.getElementById(`count-${id}`);
            if (countEl) countEl.innerText = counts[id];
        });

        if (overduePanel) overduePanel.style.display = overdueCount > 0 ? "block" : "none";
    });
}

async function addTask() {
    const title = document.getElementById("taskTitle").value.trim();
    const description = document.getElementById("taskDescription").value.trim();
    const assignedToEmail = document.getElementById("assignedToEmail").value.trim();
    const dueDate = document.getElementById("dueDate").value;
    const dueTime = document.getElementById("dueTime").value;
    const points = document.getElementById("taskPoints")?.value || 10;

    const token = localStorage.getItem("token");
    const assignedBy = localStorage.getItem("userId");

    if (!title || !assignedToEmail || !dueDate || !dueTime) {
        alert("Lütfen tüm alanları doldurun.");
        return;
    }

    try {
        const userRes = await fetch(`/get-user-id?email=${assignedToEmail}`, { headers: {"Authorization": "Bearer " + token} });
        const userData = await userRes.json();

        if (!userData.userId) return alert("Bu mail adresine sahip bir öğrenci bulunamadı!");

        // ISO Formatında birleştirme (Saat kaymasını engellemek için en güvenli yol)
        const fullIsoDate = `${dueDate}T${dueTime}:00`;

        const response = await fetch("/add-task", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({
                title, description, assignedTo: userData.userId, assignedBy,
                due_date: fullIsoDate, points: parseInt(points)
            })
        });

        if (response.ok) {
            alert("Görev başarıyla eklendi!");
            location.reload();
        }
    } catch (error) { console.error("Hata:", error); }
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

function sendCode() {
    const email = document.getElementById("email").value.trim();
    if (!email) return alert("Mail adresi gerekli!");
    fetch("/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
    }).then(res => res.json()).then(data => alert(data.message));
}

function verify() {
    const email = document.getElementById("email").value.trim();
    const code = document.getElementById("code").value.trim();
    const password = document.getElementById("password").value.trim();
    const role = localStorage.getItem("registerRole") || "parent";

    fetch("/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
    })
    .then(res => res.json())
    .then(data => {
        if (data.message === "Kod doğrulandı") {
            return fetch("/set-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, role })
            });
        } else throw new Error(data.message);
    })
    .then(() => {
        alert("Kayıt başarılı!");
        window.location.href = "index.html";
    }).catch(err => alert(err.message));
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
        } else alert(data.message);
    });
}

// -------------------- SAYFA YÜKLENDİĞİNDE --------------------
document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get("invite");
    const emailInput = document.getElementById("email");
    const roleText = document.getElementById("roleText");

    if (inviteToken && emailInput) {
        fetch(`/check-invite?invite=${inviteToken}`)
        .then(res => res.json())
        .then(data => {
            if (data.valid) {
                emailInput.value = data.email;
                localStorage.setItem("registerRole", "student");
                if (roleText) roleText.innerText = "Öğrenci (Davetli)";
            }
        });
    } else {
        localStorage.setItem("registerRole", "parent");
    }

    if (document.getElementById("taskList")) {
        loadMyTasks();
        loadStudentPoints();
    }
    if (document.getElementById("parent-list-Baslamadi")) {
        loadMyAssignedTasks();
    }
});
function fixDate(dateSource) {
    if (!dateSource) return "Belirtilmedi";
    
    const date = new Date(dateSource);
    
    // Eğer gelen tarih geçerli değilse hata verme
    if (isNaN(date.getTime())) return "Geçersiz Tarih";

    // Türkiye saati (Europe/Istanbul) için formatlama
    return date.toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul",
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}