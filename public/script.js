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
function loadMyTasks() {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    fetch(`/my-tasks/${userId}`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(tasks => {
        const list = document.getElementById("taskList");
        if (!list) return;
        list.innerHTML = tasks.length === 0 ? "<li>Henüz görev atanmamış.</li>" : "";

        tasks.forEach(task => {
            const li = document.createElement("li");
            const dueDate = task.due_date ? new Date(task.due_date) : null;
            const isOverdue = dueDate && dueDate < new Date() && task.status !== 'Tamamlandı';
            
            li.style = `border-left: 5px solid ${isOverdue ? '#e53e3e' : '#48bb78'}; background: #fff; padding: 15px; margin-bottom: 10px; border-radius: 8px; list-style:none; box-shadow: 0 2px 4px rgba(0,0,0,0.05);`;
            
            const descHtml = task.description ? `<p style="color: #555; font-size: 0.9em; margin: 5px 0;">${task.description}</p>` : "";

            li.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div style="flex: 1;">
                        <b style="font-size: 1.1em;">${task.title}</b>
                        ${descHtml}
                        <small style="display:block; margin-top:5px; color:#888;">Atayan: ${task.assigned_by}</small>
                        <span style="color: ${isOverdue ? 'red' : '#666'}; font-size: 0.85em;">⏳ ${dueDate ? dueDate.toLocaleString("tr-TR") : 'Belirtilmedi'}</span>
                    </div>
                    <select onchange="updateStatus(${task.id}, this.value)" style="margin-left: 10px; padding: 5px; border-radius: 5px;">
                        <option value="Başlamadı" ${task.status === 'Başlamadı' ? 'selected' : ''}>🔴 Başlamadı</option>
                        <option value="Başlandı" ${task.status === 'Başlandı' ? 'selected' : ''}>🔵 Başlandı</option>
                        <option value="Devam Ediyor" ${task.status === 'Devam Ediyor' ? 'selected' : ''}>🟡 Devam Ediyor</option>
                        <option value="Tamamlandı" ${task.status === 'Tamamlandı' ? 'selected' : ''}>🟢 Tamamlandı</option>
                    </select>
                </div>`;
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

        columns.forEach(id => {
            const el = document.getElementById(`parent-list-${id}`);
            if (el) el.innerHTML = "";
        });

        tasks.forEach(task => {
            const dueDate = task.due_date ? new Date(task.due_date) : null;
            const isOverdue = dueDate && dueDate < new Date() && task.status !== "Tamamlandı";
            const dateStr = dueDate ? dueDate.toLocaleString("tr-TR") : "Belirtilmedi";

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
                    
                    const descHtml = task.description ? `<p style="color: #666; font-size: 0.85em; margin: 5px 0; font-style: italic;">${task.description}</p>` : "";

                    card.innerHTML = `
                        <div style="padding-right:25px;">
                            <b style="color:${isOverdue ? '#c53030' : '#333'}">${isOverdue ? '⏳ ' : ''}${task.title}</b><br>
                            ${descHtml}
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

function addTask() {
    const title = document.getElementById("taskTitle").value;
    const description = document.getElementById("taskDescription").value;
    const assignedToEmail = document.getElementById("assignedToEmail").value;
    const dueDate = document.getElementById("dueDate").value;
    const dueTime = document.getElementById("dueTime").value;
    const points = document.getElementById("taskPoints").value; // Yeni eklenen satır

    if (!title || !assignedToEmail) {
        alert("Lütfen başlık ve öğrenci mailini doldurun.");
        return;
    }

    fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            title,
            description,
            assignedToEmail,
            dueDate,
            dueTime,
            points: parseInt(points) // Puanı sayı olarak gönderiyoruz
        })
    })
    .then(res => res.json())
    .then(data => {
        alert("Görev başarıyla eklendi!");
        location.reload();
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

function sendCode() {
    const emailInput = document.getElementById("email");
    const email = emailInput ? emailInput.value.trim() : "";
    if (!email) return alert("Lütfen geçerli bir mail adresi giriniz!");

    fetch("/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email })
    })
    .then(res => res.json())
    .then(data => alert(data.message));
}

function verify() {
    const email = document.getElementById("email").value.trim();
    const code = document.getElementById("code").value.trim();
    const password = document.getElementById("password").value.trim();
    const role = localStorage.getItem("registerRole") || "parent";

    if (!email || !code || !password) return alert("Tüm alanları doldurun!");

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
    .then(res => res.json())
    .then(() => {
        alert("Kayıt tamamlandı!");
        window.location.href = "index.html";
    })
    .catch(err => alert("Hata: " + err.message));
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

document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get("invite");
    const emailInput = document.getElementById("email");
    const roleText = document.getElementById("roleText");

    if (!inviteToken) {
        localStorage.setItem("registerRole", "parent");
        if (roleText) roleText.innerText = "Veli";
    }

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
    }
    if (document.getElementById("taskList")) loadMyTasks();
});