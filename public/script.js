// -------------------- SEND CODE --------------------
function sendCode() {
    const email = document.getElementById("email").value.trim();
    if (!email) return alert("Email boş olamaz!");
    fetch("/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
    }).then(res => res.json()).then(data => alert(data.message)).catch(() => alert("Mail gönderilemedi!"));
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
    }).then(res => res.json()).then(data => {
        if (data.message === "Kod doğrulandı") setPassword();
        else alert(data.message);
    }).catch(() => alert("Kod doğrulanamadı!"));
}

// -------------------- SET PASSWORD --------------------
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
// -------------------- LOGIN --------------------
// script.js içindeki login fonksiyonunu bununla GÜNCELLE
function login() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    let role = localStorage.getItem("loginRole"); 
    if (!role) {
        alert("Lütfen önce Veli veya Öğrenci girişi seçeneğine tıklayın.");
        window.location.href = "index.html";
        return;
    }
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
    }).catch(() => alert("Sunucuya bağlanılamadı."));
}
// -------------------- LOGOUT --------------------
function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}

// -------------------- ÖĞRENCİ GÖREVLERİ --------------------
// -------------------- VELİ GÖREVLERİ LİSTELE (GÜNCEL) --------------------
function loadMyTasks() {
    const userId = localStorage.getItem("userId");
    const token = localStorage.getItem("token");
    if (!userId) return;

    fetch(`/my-tasks/${userId}`, {
        headers: { "Authorization": "Bearer " + token }
    })
    .then(res => res.json())
    .then(tasks => {
        // Tüm listeleri temizle
        const lists = ["Baslamadi", "Baslandi", "DevamEdiyor", "Tamamlandi"];
        lists.forEach(id => {
            const el = document.getElementById(`list-${id}`);
            if (el) el.innerHTML = "";
        });

        tasks.forEach(task => {
            // Durum ismindeki boşlukları temizle (Örn: "Devam Ediyor" -> "DevamEdiyor")
            const statusId = task.status.replace(/\s+/g, '');
            const targetList = document.getElementById(`list-${statusId}`);

            if (targetList) {
                const li = document.createElement("li");
                const dueDate = task.due_date ? new Date(task.due_date) : null;
                const isOverdue = dueDate && dueDate < new Date() && task.status !== 'Tamamlandı';

                li.className = "task-card";
                li.style = `background: white; margin-bottom: 10px; padding: 10px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 5px solid ${isOverdue ? 'red' : '#ccc'}`;

                li.innerHTML = `
                    <b style="display:block; margin-bottom:5px;">${task.title}</b>
                    ${dueDate ? `<small style="color:${isOverdue ? 'red' : '#666'}">⏳ ${dueDate.toLocaleDateString("tr-TR")}</small><br>` : ''}
                    
                    <select onchange="updateStatusAndReload(${task.id}, this.value)" style="width:100%; margin-top:5px; font-size:12px;">
                        <option value="Başlamadı" ${task.status === 'Başlamadı' ? 'selected' : ''}>🔴 Başlamadı</option>
                        <option value="Başlandı" ${task.status === 'Başlandı' ? 'selected' : ''}>🔵 Başlandı</option>
                        <option value="Devam Ediyor" ${task.status === 'Devam Ediyor' ? 'selected' : ''}>🟡 Devam Ediyor</option>
                        <option value="Tamamlandı" ${task.status === 'Tamamlandı' ? 'selected' : ''}>🟢 Tamamlandı</option>
                    </select>
                `;
                targetList.appendChild(li);
            }
        });
    });
}

// Durum güncellendiğinde sayfayı yenileyen yardımcı fonksiyon
function updateStatusAndReload(taskId, status) {
    fetch("/update-task-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + localStorage.getItem("token") },
        body: JSON.stringify({ taskId, status })
    }).then(() => {
        loadMyTasks(); // Kartı yeni kutusuna taşımak için listeyi yenile
    });
}
// -------------------- GÖREV DURUMU GÜNCELLE --------------------
function updateStatus(taskId, status) {
    fetch("/update-task-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + localStorage.getItem("token") },
        body: JSON.stringify({ taskId, status })
    }).then(() => { if(status === "Tamamlandı") alert("Görev tamamlandı olarak işaretlendi!"); });
}
// -------------------- VELİ GÖREVLERİ --------------------
// script.js içinde bu fonksiyonun adının doğruluğunu kontrol et
function loadMyAssignedTasks() {
    const userId = localStorage.getItem("userId");
    fetch(`/my-assigned-tasks/${userId}`, {
        headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    }).then(res => res.json()).then(tasks => {
        const list = document.getElementById("assignedTaskList");
        if (!list) return;
        list.innerHTML = "";
        tasks.forEach(task => {
            const li = document.createElement("li");
            const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString("tr-TR") : "Belirtilmedi";
            li.innerHTML = `
                <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee;">
                    <span><b>${task.title}</b> (Kime: ${task.assigned_to})<br><small>Son Tarih: ${dueDate} - Durum: ${task.status}</small></span>
                    <button onclick="deleteTask(${task.id})" style="background:red; color:white;">Sil</button>
                </div>`;
            list.appendChild(li);
        });
    });
}

// -------------------- VELİ GÖREV EKLE --------------------
function addTask() {
    const title = document.getElementById("taskTitle").value;
    const email = document.getElementById("assignedToEmail").value;
    const dueDate = document.getElementById("dueDate").value;
    
    fetch(`/get-user-id?email=${email}`, { headers: { "Authorization": "Bearer " + localStorage.getItem("token") } })
    .then(res => res.json()).then(data => {
        if (!data.userId) return alert("Öğrenci bulunamadı!");
        fetch("/add-task", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + localStorage.getItem("token") },
            body: JSON.stringify({ title, assignedBy: localStorage.getItem("userId"), assignedTo: data.userId, due_date: dueDate || null })
        }).then(() => { alert("Görev atandı!"); loadMyAssignedTasks(); });
    });
}

// -------------------- VELİ ÖĞRENCİ DAVET ET --------------------
async function inviteStudent() {
    const email = document.getElementById("inviteEmail").value;
    const res = await fetch("/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ email })
    });
    if (res.ok) document.getElementById("inviteMessage").innerText = "Davet Gönderildi!";
}

// -------------------- KAYIT SAYFASI INIT --------------------
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
// -------------------- DEBUG INVITE TOKEN WORKFLOW --------------------
async function debugInviteWorkflow(testEmail) {
    console.log("===== INVITE DEBUG START =====");
    if (!testEmail) {
        console.log("Test email girilmedi. Örn: debugInviteWorkflow('test@student.com')");
        return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
        console.log("Parent login token bulunamadı. Önce login ol!");
        return;
    }

    try {
        // 1️⃣ Invite gönder
        console.log("1️⃣ Invite gönderiliyor...");
        const inviteRes = await fetch("/invite", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ email: testEmail })
        });
        const inviteData = await inviteRes.json();
        console.log("Invite gönderme cevabı:", inviteData);

        if (!inviteRes.ok) return console.log("Invite gönderilemedi, debug durduruldu.");

        // 2️⃣ DB'den token doğrulama
        console.log("2️⃣ Token DB'den kontrol ediliyor...");
        // Normalde mailde gönderilen link kullanılır ama biz direkt DB tokeni alıyoruz
        const params = new URLSearchParams(window.location.search);
        const tokenFromDB = inviteData?.token || null;

        // Eğer inviteData içinde token dönmüyorsa, direkt DB’den token çekmek gerekir
        // Bu kısmı backend log ile test edebilirsin

        // 3️⃣ /check-invite endpoint test
        const checkRes = await fetch(`/check-invite?invite=${tokenFromDB || ''}`);
        const checkData = await checkRes.json();
        console.log("/check-invite cevabı:", checkData);

        if (!checkData.valid) {
            console.log("Token geçersiz veya DB’de yok!");
        } else {
            console.log("Token geçerli, email:", checkData.email);
        }

        console.log("===== INVITE DEBUG END =====");

    } catch (err) {
        console.error("DEBUG HATASI:", err);
    }
}
function registerStart() {
    const role = localStorage.getItem("registerRole") || "student";
    localStorage.setItem("registerRole", role); // Son kez sağlama al
    sendCode(); // Mevcut sendCode fonksiyonunu çağırır
}
// Örn kullanım: debugInviteWorkflow("ogrenci@test.com");
// script.js içine eklenecek veya güncellenecek fonksiyon
function deleteTask(taskId) {
    if (!confirm("Silinsin mi?")) return;
    fetch(`/delete-task/${taskId}`, {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    }).then(() => loadMyAssignedTasks());
}