function getAuthHeaders() {
    return { "Content-Type": "application/json", "Authorization": "Bearer " + localStorage.getItem("token") };
}

function logout() { localStorage.clear(); window.location.href = "index.html"; }

// --- ÖĞRENCİ PANELİ ---
function loadMyTasks() {
    const userId = localStorage.getItem("userId");
    fetch(`/my-tasks/${userId}`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(tasks => {
        const list = document.getElementById("taskList");
        if (!list) return;
        list.innerHTML = "";
        tasks.forEach(task => {
            const li = document.createElement("li");
            const descHtml = task.description ? `<p style="color:#666; font-size:0.9em; margin:5px 0;">${task.description}</p>` : "";
            li.style = "background:#fff; padding:15px; margin-bottom:10px; border-radius:8px; list-style:none; box-shadow:0 2px 4px rgba(0,0,0,0.05);";
            li.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div>
                        <b>${task.title}</b>
                        ${descHtml}
                        <small style="display:block; color:#999;">Atayan: ${task.assigned_by}</small>
                    </div>
                    <select onchange="updateStatus(${task.id}, this.value)" style="padding:5px; border-radius:5px;">
                        <option value="Başlamadı" ${task.status==='Başlamadı'?'selected':''}>🔴 Başlamadı</option>
                        <option value="Başlandı" ${task.status==='Başlandı'?'selected':''}>🔵 Başlandı</option>
                        <option value="Devam Ediyor" ${task.status==='Devam Ediyor'?'selected':''}>🟡 Devam Ediyor</option>
                        <option value="Tamamlandı" ${task.status==='Tamamlandı'?'selected':''}>🟢 Tamamlandı</option>
                    </select>
                </div>`;
            list.appendChild(li);
        });
    });
}

function updateStatus(taskId, status) {
    fetch("/update-task-status", { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ taskId, status }) });
}

// --- VELİ PANELİ ---
function loadMyAssignedTasks() {
    const userId = localStorage.getItem("userId");
    fetch(`/my-assigned-tasks/${userId}`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(tasks => {
        const columns = ["Baslamadi", "Baslandi", "DevamEdiyor", "Tamamlandi"];
        columns.forEach(id => document.getElementById(`parent-list-${id}`).innerHTML = "");
        
        tasks.forEach(task => {
            let sk = task.status === "Başlamadı" ? "Baslamadi" : task.status === "Başlandı" ? "Baslandi" : task.status === "Devam Ediyor" ? "DevamEdiyor" : "Tamamlandi";
            const container = document.getElementById(`parent-list-${sk}`);
            if (container) {
                const card = document.createElement("div");
                const descHtml = task.description ? `<p style="color:#777; font-size:0.8em; font-style:italic;">${task.description}</p>` : "";
                card.style = "background:#fff; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #eee;";
                card.innerHTML = `<b>${task.title}</b>${descHtml}<br><small>👤 ${task.assigned_to}</small>
                                  <button onclick="deleteTask(${task.id})" style="float:right; border:none; background:none; cursor:pointer;">🗑️</button>`;
                container.appendChild(card);
            }
        });
    });
}

function addTask() {
    const title = document.getElementById("taskTitle").value;
    const description = document.getElementById("taskDescription").value;
    const email = document.getElementById("assignedToEmail").value;
    const dueDate = document.getElementById("dueDate").value;

    fetch(`/get-user-id?email=${email}`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(data => {
        if (!data.userId) return alert("Öğrenci bulunamadı");
        fetch("/add-task", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ title, description, assignedBy: localStorage.getItem("userId"), assignedTo: data.userId, due_date: dueDate })
        }).then(() => location.reload());
    });
}

function deleteTask(id) { if(confirm("Silinsin mi?")) fetch(`/delete-task/${id}`, { method: "DELETE", headers: getAuthHeaders() }).then(loadMyAssignedTasks); }

function sendInvite() {
    const email = document.getElementById("inviteEmail").value;
    fetch("/send-invite", { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ email }) }).then(() => alert("Davet Gitti"));
}

// --- KAYIT & GİRİŞ ---
function sendCode() {
    const email = document.getElementById("email").value;
    fetch("/send-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }).then(() => alert("Kod yollandı"));
}

function verify() {
    const email = document.getElementById("email").value;
    const code = document.getElementById("code").value;
    const password = document.getElementById("password").value;
    const role = localStorage.getItem("registerRole") || "parent";

    fetch("/verify-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }) })
    .then(res => res.json()).then(data => {
        if (data.message === "Kod doğrulandı") {
            fetch("/set-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, role }) })
            .then(() => { alert("Başarılı!"); window.location.href="index.html"; });
        }
    });
}

function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const role = localStorage.getItem("loginRole");
    fetch("/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, role }) })
    .then(res => res.json()).then(data => {
        if(data.token) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("userId", data.userId);
            localStorage.setItem("role", data.role);
            window.location.href = data.role === "parent" ? "veli-dashboard.html" : "dashboard.html";
        } else alert("Hata");
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    if (invite) {
        fetch(`/check-invite?invite=${invite}`).then(res => res.json()).then(data => {
            if (data.valid) {
                document.getElementById("email").value = data.email;
                localStorage.setItem("registerRole", "student");
                document.getElementById("roleText").innerText = "Öğrenci";
            }
        });
    } else if (document.getElementById("roleText")) {
        localStorage.setItem("registerRole", "parent");
        document.getElementById("roleText").innerText = "Veli";
    }
    if (document.getElementById("taskList")) loadMyTasks();
    if (document.getElementById("parent-list-Baslamadi")) loadMyAssignedTasks();
});