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

    if (!userId || !token) return;

    fetch(`/my-assigned-tasks/${userId}`, {
        headers: { "Authorization": "Bearer " + token }
    })
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
            const countEl = document.getElementById(`count-${id}`);
            if (countEl) countEl.innerText = "0";
        });

        tasks.forEach(task => {
            const now = new Date();
            // Veritabanından gelen tarihi Date objesine çevir
            const dueDate = task.due_date ? new Date(task.due_date) : null;
            
            const isOverdue = dueDate && dueDate < now && task.status !== "Tamamlandı";

            let dateDisplay = "Belirtilmedi";
            if (dueDate) {
                // Yerel tarih ve saat formatı (Bilgisayarının saat dilimini kullanır)
                const datePart = dueDate.toLocaleDateString("tr-TR");
                const timePart = dueDate.toLocaleTimeString("tr-TR", { 
                    hour: '2-digit', 
                    minute: '2-digit'
                });

                // Eğer saat tam gece yarısı (00:00) değilse saati de yaz
                dateDisplay = (dueDate.getHours() === 0 && dueDate.getMinutes() === 0) 
                    ? datePart 
                    : `${datePart} | ⏰ ${timePart}`;
            }

            if (isOverdue) {
                overdueCount++;
                const li = document.createElement("li");
                li.style.marginBottom = "5px";
                li.innerHTML = `⚠️ <b>${task.title}</b> - <small>(Öğrenci: ${task.assigned_to} / Vade: ${dateDisplay})</small>`;
                if (overdueList) overdueList.appendChild(li);
            }

            let statusKey = "";
            if (task.status === "Başlamadı") statusKey = "Baslamadi";
            else if (task.status === "Başlandı") statusKey = "Baslandi";
            else if (task.status === "Devam Ediyor") statusKey = "DevamEdiyor";
            else if (task.status === "Tamamlandı") statusKey = "Tamamlandi";

            if (statusKey) {
                counts[statusKey]++;
                const targetColumn = document.getElementById(`parent-list-${statusKey}`);
                
                if (targetColumn) {
                    const card = document.createElement("div");
                    card.className = "task-card"; // Varsa CSS'ten çekebilirsin
                    card.style = `
                        background: #fff; 
                        border: 2px solid ${isOverdue ? '#fc8181' : '#ddd'}; 
                        margin-bottom: 12px; 
                        padding: 12px; 
                        border-radius: 6px; 
                        position: relative; 
                        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    `;
                    
                    card.innerHTML = `
                        <div style="padding-right: 25px;">
                            <div style="font-weight:bold; color:${isOverdue ? '#c53030' : '#333'}; margin-bottom: 5px;">
                                ${isOverdue ? '⏳ ' : ''}${task.title}
                            </div>
                            <div style="font-size:12px; color:#666; line-height: 1.5;">
                                👤 <b>Öğrenci:</b> ${task.assigned_to}<br>
                                📅 <b>Tarih:</b> ${dateDisplay} ${isOverdue ? '<br><b style="color:#c53030;">(SÜRESİ GEÇTİ)</b>' : ''}
                            </div>
                        </div>
                        <button onclick="deleteTask(${task.id})" 
                                title="Görevi Sil"
                                style="position:absolute; top:10px; right:10px; background:none; border:none; cursor:pointer; font-size:18px;">
                            🗑️
                        </button>
                    `;
                    targetColumn.appendChild(card);
                }
            }
        });

        // Sayaçları güncelle
        columns.forEach(id => {
            const cEl = document.getElementById(`count-${id}`);
            if (cEl) cEl.innerText = counts[id];
        });

        if (overduePanel) {
            overduePanel.style.display = overdueCount > 0 ? "block" : "none";
        }
    })
    .catch(err => console.error("Yükleme hatası:", err));
}

function addTask() {
    const title = document.getElementById("taskTitle").value;
    const email = document.getElementById("assignedToEmail").value;
    const dueDate = document.getElementById("dueDate").value; // Örn: 2023-10-25
    const dueTime = document.getElementById("dueTime").value; // Örn: 18:30

    // Temel kontrol
    if (!title || !email) {
        alert("Lütfen görev başlığını ve öğrenci mailini doldurun!");
        return;
    }

    const token = localStorage.getItem("token");

    // 1. Adım: Email adresinden öğrencinin userId'sini al
    fetch(`/get-user-id?email=${email}`, {
        headers: { "Authorization": "Bearer " + token }
    })
    .then(res => res.json())
    .then(data => {
        if (!data.userId) {
            alert("Bu mail adresine kayıtlı bir öğrenci bulunamadı!");
            return;
        }

        // 2. Adım: Tarih ve Saati birleştir
        let finalDateTime = null;
        if (dueDate) {
            // Saat girilmişse "YYYY-MM-DD HH:mm:00" formatında birleştir
            // 'T' yerine boşluk kullanmak PostgreSQL'in yerel saati anlamasına yardımcı olur
            finalDateTime = dueTime ? `${dueDate} ${dueTime}:00` : dueDate;
        }

        // 3. Adım: Görevi veritabanına ekle
        fetch("/add-task", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": "Bearer " + token 
            },
            body: JSON.stringify({
                title: title,
                assignedBy: localStorage.getItem("userId"),
                assignedTo: data.userId,
                due_date: finalDateTime // Birleştirilmiş tarih ve saat
            })
        })
        .then(res => {
            if (res.ok) {
                alert("Görev başarıyla atandı!");
                
                // Formu temizle
                document.getElementById("taskTitle").value = "";
                document.getElementById("assignedToEmail").value = "";
                document.getElementById("dueDate").value = "";
                document.getElementById("dueTime").value = "";

                // Listeyi anlık olarak yenile
                loadMyAssignedTasks();
            } else {
                alert("Görev eklenirken bir hata oluştu.");
            }
        })
        .catch(err => console.error("Görev ekleme hatası:", err));
    })
    .catch(err => {
        console.error("Kullanıcı sorgulama hatası:", err);
        alert("Sistem hatası oluştu.");
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