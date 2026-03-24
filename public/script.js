// -------------------- AUTH & GENEL --------------------
function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}

// -------------------- ÖĞRENCİ FONKSİYONLARI --------------------
function loadMyTasks() {
    const userId = localStorage.getItem("userId");
    const token = localStorage.getItem("token");
    if (!userId || !token) return;

    fetch(`/my-tasks/${userId}`, {
        headers: { "Authorization": "Bearer " + token }
    })
    .then(res => res.json())
    .then(tasks => {
        const list = document.getElementById("taskList");
        if (!list) return;
        list.innerHTML = "";

        if (!tasks || tasks.length === 0) {
            list.innerHTML = "<li>Henüz görev atanmamış.</li>";
            return;
        }

        tasks.forEach(task => {
            const li = document.createElement("li");
            const assignedDate = new Date(task.assigned_at).toLocaleDateString("tr-TR");
            const dueDate = task.due_date ? new Date(task.due_date) : null;
            const isOverdue = dueDate && dueDate < new Date() && task.status !== 'Tamamlandı';

            li.style = `border-left: 5px solid ${isOverdue ? 'red' : '#4CAF50'}; background: ${isOverdue ? '#fff5f5' : '#fff'}; padding: 10px; margin-bottom: 10px; list-style: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1);`;

            li.innerHTML = `
                <div>
                    <b>${task.title}</b><br>
                    <small>Atayan: ${task.assigned_by}</small><br>
                    <small>Başlangıç: ${assignedDate}</small><br>
                    ${dueDate ? `<b style="color: ${isOverdue ? 'red' : '#2196F3'};">⏳ Son Teslim: ${dueDate.toLocaleDateString("tr-TR")} ${isOverdue ? '(SÜRESİ GEÇTİ!)' : ''}</b>` : '<i>Süre belirtilmedi</i>'}
                </div>
                <div style="margin-top:10px;">
                    Durum: 
                    <select onchange="updateStatus(${task.id}, this.value)">
                        <option value="Başlamadı" ${task.status === 'Başlamadı' ? 'selected' : ''}>🔴 Başlamadı</option>
                        <option value="Başlandı" ${task.status === 'Başlandı' ? 'selected' : ''}>🔵 Başlandı</option>
                        <option value="Devam Ediyor" ${task.status === 'Devam Ediyor' ? 'selected' : ''}>🟡 Devam Ediyor</option>
                        <option value="Tamamlandı" ${task.status === 'Tamamlandı' ? 'selected' : ''}>🟢 Tamamlandı</option>
                    </select>
                </div>
            `;
            list.appendChild(li);
        });
    });
}

function updateStatus(taskId, status) {
    fetch("/update-task-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + localStorage.getItem("token") },
        body: JSON.stringify({ taskId, status })
    }).then(() => {
        alert("Durum güncellendi!");
        loadMyTasks(); 
    });
}

// -------------------- VELİ FONKSİYONLARI (KANBAN) --------------------
function loadMyAssignedTasks() {
    const userId = localStorage.getItem("userId");
    const token = localStorage.getItem("token");

    if (!userId || !token) {
        console.error("Giriş bilgileri eksik!");
        return;
    }

    fetch(`/my-assigned-tasks/${userId}`, {
        headers: { "Authorization": "Bearer " + token }
    })
    .then(res => {
        if (!res.ok) throw new Error("Yetki hatası veya sunucu hatası");
        return res.json();
    })
    .then(tasks => {
        console.log("Gelen Görevler:", tasks); // Tarayıcı konsolunda kontrol et (F12)

        // Sütun ID'lerini temizle
        const columns = ["Baslamadi", "Baslandi", "DevamEdiyor", "Tamamlandi"];
        columns.forEach(id => {
            const el = document.getElementById(`parent-list-${id}`);
            if (el) el.innerHTML = "";
        });

        if (!tasks || tasks.length === 0) {
            console.log("Atanmış görev bulunamadı.");
            return;
        }

        tasks.forEach(task => {
            // Durum metnindeki boşlukları kaldır (Örn: "Devam Ediyor" -> "DevamEdiyor")
            const statusId = task.status.replace(/\s+/g, '');
            const targetColumn = document.getElementById(`parent-list-${statusId}`);

            if (targetColumn) {
                const card = document.createElement("div");
                const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString("tr-TR") : "Belirtilmedi";
                
                card.style = `
                    background: white; 
                    margin-bottom: 12px; 
                    padding: 15px; 
                    border-radius: 8px; 
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    border-left: 5px solid #3498db;
                `;

                card.innerHTML = `
                    <strong style="display:block; font-size:1.1em; color:#2c3e50;">${task.title}</strong>
                    <div style="margin-top:8px; font-size:0.9em; color:#7f8c8d;">
                        <span>👤 <b>Öğrenci:</b> ${task.assigned_to}</span><br>
                        <span>📅 <b>Son Tarih:</b> ${dueDate}</span>
                    </div>
                    <div style="margin-top: 12px; text-align: right; border-top: 1px solid #eee; padding-top: 8px;">
                        <button onclick="deleteTask(${task.id})" style="background:none; border:none; color:#e74c3c; cursor:pointer; font-weight:bold;">🗑️ Sil</button>
                    </div>
                `;
                targetColumn.appendChild(card);
            } else {
                console.warn("Hedef sütun bulunamadı:", `parent-list-${statusId}`);
            }
        });
    })
    .catch(err => console.error("Görev yükleme hatası:", err));
}

function addTask() {
    const title = document.getElementById("taskTitle").value;
    const email = document.getElementById("assignedToEmail").value;
    const dueDate = document.getElementById("dueDate").value;
    const token = localStorage.getItem("token");

    if(!title || !email) return alert("Başlık ve e-mail zorunludur!");

    fetch(`/get-user-id?email=${email}`, { headers: { "Authorization": "Bearer " + token } })
    .then(res => res.json()).then(data => {
        if (!data.userId) return alert("Öğrenci bulunamadı!");
        fetch("/add-task", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ 
                title, 
                assignedBy: localStorage.getItem("userId"), 
                assignedTo: data.userId, 
                due_date: dueDate || null 
            })
        }).then(() => { 
            alert("Görev atandı!"); 
            document.getElementById("taskTitle").value = "";
            loadMyAssignedTasks(); 
        });
    });
}

function deleteTask(taskId) {
    if (!confirm("Bu görevi silmek istediğinize emin misiniz?")) return;
    fetch(`/delete-task/${taskId}`, {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    }).then(() => loadMyAssignedTasks());
}

// -------------------- KAYIT & DİĞER --------------------
function sendCode() {
    const email = document.getElementById("email").value.trim();
    if (!email) return alert("Email boş olamaz!");
    fetch("/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
    }).then(res => res.json()).then(data => alert(data.message));
}

function verify() {
    const email = document.getElementById("email").value.trim();
    const code = document.getElementById("code").value.trim();
    fetch("/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
    }).then(res => res.json()).then(data => {
        if (data.message === "Kod doğrulandı") setPassword();
        else alert(data.message);
    });
}

function setPassword() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const role = localStorage.getItem("registerRole");
    fetch("/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role })
    }).then(res => res.json()).then(data => {
        alert(data.message);
        window.location.href = role === "parent" ? "veli-dashboard.html" : "dashboard.html";
    });
}

function login() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    let role = localStorage.getItem("loginRole"); 
    fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role })
    }).then(res => res.json()).then(data => {
        if (data.message === "Giriş başarılı") {
            localStorage.setItem("userId", data.userId);
            localStorage.setItem("role", data.role);
            localStorage.setItem("token", data.token);
            window.location.href = data.role.toLowerCase() === "parent" ? "veli-dashboard.html" : "dashboard.html";
        } else alert(data.message);
    });
}

async function inviteStudent() {
    const email = document.getElementById("inviteEmail").value;
    const res = await fetch("/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ email })
    });
    if (res.ok) document.getElementById("inviteMessage").innerText = "Davet Gönderildi!";
}

document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get("invite");
    const emailInput = document.getElementById("email");
    if (inviteToken && emailInput) {
        fetch(`/check-invite?invite=${inviteToken}`).then(res => res.json()).then(data => {
            if (data.valid) {
                emailInput.value = data.email;
                emailInput.readOnly = true;
                localStorage.setItem("registerRole", "student");
            }
        });
    }
});