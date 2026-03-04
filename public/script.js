// -------------------- SEND CODE --------------------
function sendCode() {
    const email = document.getElementById("email").value.trim();
    if (!email) return alert("Email boş olamaz!");

    fetch("/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
    })
    .then(res => res.json())
    .then(data => alert(data.message))
    .catch(() => alert("Mail gönderilemedi!"));
}

// -------------------- VERIFY CODE --------------------
function verify() {
    const email = document.getElementById("email").value.trim();
    const code = document.getElementById("code").value.trim();
    if (!code) return alert("Kod boş olamaz!");

    fetch("/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
    })
    .then(res => res.json())
    .then(data => {
        if (data.message === "Kod doğrulandı") setPassword();
        else alert(data.message);
    })
    .catch(() => alert("Kod doğrulanamadı!"));
}

// -------------------- SET PASSWORD --------------------
function setPassword() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const role = localStorage.getItem("registerRole");
    if (!password) return alert("Şifre boş olamaz!");

    fetch("/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        window.location.href = role === "parent" ? "veli-dashboard.html" : "dashboard.html";
    })
    .catch(() => alert("Şifre kaydedilemedi!"));
}

// -------------------- LOGIN --------------------
function login() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const role = localStorage.getItem("loginRole");

    fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role })
    })
    .then(res => res.json())
    .then(data => {
        if (data.message === "Giriş başarılı") {
            localStorage.setItem("userId", data.userId);
            localStorage.setItem("role", data.role);
            localStorage.setItem("token", data.token);
            localStorage.removeItem("loginRole");

            if (data.role === "parent") window.location.href = "veli-dashboard.html";
            else window.location.href = "dashboard.html";
        } else alert(data.message);
    });
}

// -------------------- LOGOUT --------------------
function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}

// -------------------- ÖĞRENCİ GÖREVLERİ --------------------
function loadMyTasks() {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    fetch(`/my-tasks/${userId}`, {
        headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    })
    .then(res => res.json())
    .then(tasks => {
        const list = document.getElementById("taskList");
        list.innerHTML = "";

        if (!tasks.length) {
            list.innerHTML = "<li>Henüz görev atanmamış.</li>";
            return;
        }

        tasks.forEach(task => {
            const li = document.createElement("li");
            const date = new Date(task.assigned_at).toLocaleDateString("tr-TR");
            li.innerHTML = `
                <b>${task.title}</b><br>
                Atayan: ${task.assigned_by}<br>
                Tarih: ${date}<br>
                Durum:
                <select id="status-${task.id}" onchange="updateStatus(${task.id})">
                    <option value="Başlamadı" ${task.status === 'Başlamadı' ? 'selected' : ''}>Başlamadı</option>
                    <option value="Başlandı" ${task.status === 'Başlandı' ? 'selected' : ''}>Başlandı</option>
                    <option value="Devam Ediyor" ${task.status === 'Devam Ediyor' ? 'selected' : ''}>Devam Ediyor</option>
                    <option value="Tamamlandı" ${task.status === 'Tamamlandı' ? 'selected' : ''}>Tamamlandı</option>
                </select>
                <hr>
            `;
            list.appendChild(li);
        });
    })
    .catch(() => {
        const list = document.getElementById("taskList");
        list.innerHTML = "<li>Görevler yüklenemedi. Sayfayı yenileyin.</li>";
    });
}

// -------------------- GÖREV DURUMU GÜNCELLE --------------------
function updateStatus(taskId) {
    const status = document.getElementById(`status-${taskId}`).value;

    fetch("/update-task-status", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({ taskId, status })
    })
    .then(res => res.json())
    .then(data => console.log(data.message));
}

// -------------------- VELİ GÖREVLERİ --------------------
function loadMyAssignedTasks() {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    fetch(`/my-assigned-tasks/${userId}`, {
        headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    })
    .then(res => res.json())
    .then(tasks => {
        const list = document.getElementById("assignedTaskList");
        list.innerHTML = "";

        if (!tasks.length) {
            list.innerHTML = "<li>Henüz görev atanmamış.</li>";
            return;
        }

        tasks.forEach(task => {
            const li = document.createElement("li");
            const date = new Date(task.assigned_at).toLocaleDateString("tr-TR");
            li.innerHTML = `
                <b>${task.title}</b><br>
                Atanan: ${task.assigned_to}<br>
                Atama Tarihi: ${date}<br>
                Durum: ${task.status || "Başlamadı"}<br><br>
                <button onclick="deleteTask(${task.id})">🗑️ Sil</button>
            `;
            list.appendChild(li);
        });
    });
}

// -------------------- VELİ GÖREV EKLE --------------------
function addTask() {
    const title = document.getElementById("taskTitle").value.trim();
    const assignedToEmail = document.getElementById("assignedToEmail").value.trim();
    const assignedBy = localStorage.getItem("userId");

    if (!title || !assignedToEmail || !assignedBy) {
        alert("Eksik bilgi! Lütfen tüm alanları doldurun.");
        return;
    }

    fetch(`/get-user-id?email=${assignedToEmail}`, {
        headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    })
    .then(res => res.json())
    .then(data => {
        if (!data.userId) return alert("Öğrenci bulunamadı!");

        fetch("/add-task", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("token")
            },
            body: JSON.stringify({ title, assignedBy, assignedTo: data.userId })
        })
        .then(res => res.json())
        .then(data => {
            alert(data.message);
            loadMyAssignedTasks();
        });
    });
}

// -------------------- VELİ ÖĞRENCİ DAVET ET --------------------
async function inviteStudent() {
    const email = document.getElementById("inviteEmail").value.trim();
    const token = localStorage.getItem("token");
    const messageEl = document.getElementById("inviteMessage");

    if (!email) {
        messageEl.textContent = "Lütfen bir email girin!";
        return;
    }

    try {
        const res = await fetch("/invite", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ email })
        });

        const data = await res.json();

        if (res.ok) {
            messageEl.textContent = "Davet başarıyla gönderildi!";
        } else {
            messageEl.textContent = data.message || "Davet gönderilemedi!";
        }

    } catch {
        messageEl.textContent = "Davet gönderilemedi!";
    }
}

// -------------------- KAYIT SAYFASI INIT --------------------
document.addEventListener("DOMContentLoaded", () => {

    const emailInput = document.getElementById("email");
    if (!emailInput) return;

    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get("invite");

    if (inviteToken) {
        fetch(`/check-invite?invite=${inviteToken}`)
            .then(res => res.json())
            .then(data => {
                if (!data.valid) {
                    alert("Davet linki geçersiz veya süresi dolmuş!");
                    window.location.href = "index.html";
                } else {
                    emailInput.value = data.email;
                    emailInput.readOnly = true;
                    localStorage.setItem("registerRole", "student");
                }
            })
            .catch(() => {
                alert("Sunucu hatası.");
                window.location.href = "index.html";
            });
    } else {
        emailInput.readOnly = false;
        localStorage.setItem("registerRole", "student");
    }
});