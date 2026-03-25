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
    const userId = localStorage.getItem("userId");
    // Senin server.js'deki route ile uyumlu (/my-tasks/)
    const res = await fetch(`/my-tasks/${userId}`, { headers: getAuthHeaders() });
    const tasks = await res.json();
    
    const taskList = document.getElementById("taskList");
    const completedTaskList = document.getElementById("completedTaskList");
    const completedCountLabel = document.getElementById("completed-count");

    taskList.innerHTML = "";
    completedTaskList.innerHTML = "";
    let doneCounter = 0;

    tasks.forEach(task => {
        const li = document.createElement("li");
        
        if (task.status === "Tamamlandı") {
            // BURASI SENİN GEÇMİŞİN - HİÇBİR ZAMAN SİLİNMEZ
            doneCounter++;
            li.style = "background: #f8fafc; padding: 15px; border-radius: 12px; margin-bottom: 10px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; opacity: 0.8;";
            li.innerHTML = `
                <div>
                    <span style="color: #64748b; text-decoration: line-through; font-weight: 500;">✅ ${task.title}</span>
                    <br><small style="color: #94a3b8;">Tamamlandı</small>
                </div>
                <span style="color: #38a169; font-weight: bold; background: #dcfce7; padding: 4px 10px; border-radius: 15px; font-size: 0.8rem;">+${task.points} GP</span>
            `;
            completedTaskList.appendChild(li);
        } else {
            // AKTİF GÖREVLER (4 Seçenekli Statü Menüsü ile)
            li.style = "background: white; padding: 20px; border-radius: 15px; margin-bottom: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border-left: 6px solid #4facfe; display: flex; flex-direction: column; gap: 12px;";
            li.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>${task.title}</strong>
                    <span style="color: #4facfe; font-weight: bold;">💎 ${task.points} GP</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; border-top: 1px solid #f1f5f9; padding-top: 10px;">
                    <select onchange="updateTaskStatus(${task.id}, this.value)" style="flex: 1; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; cursor: pointer;">
                        <option value="Baslamadi" ${task.status === 'Baslamadi' ? 'selected' : ''}>🔴 Başlamadı</option>
                        <option value="Baslandi" ${task.status === 'Baslandi' ? 'selected' : ''}>🔵 Başlandı</option>
                        <option value="Devam Ediyor" ${task.status === 'Devam Ediyor' ? 'selected' : ''}>🟡 Devam Ediyor</option>
                        <option value="Tamamlandı" ${task.status === 'Tamamlandı' ? 'selected' : ''}>🟢 Tamamlandı</option>
                    </select>
                </div>
            `;
            taskList.appendChild(li);
        }
    });

    if(completedCountLabel) completedCountLabel.innerText = doneCounter;
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

        // Kolon içeriklerini temizle
        columns.forEach(id => {
            const el = document.getElementById(`parent-list-${id}`);
            if (el) el.innerHTML = "";
        });

        tasks.forEach(task => {
            const dateStr = fixDate(task.due_date);
            const dueDateObj = new Date(task.due_date);
            const isOverdue = dueDateObj < new Date() && task.status !== "Tamamlandı";

            if (isOverdue) {
                overdueCount++;
                const li = document.createElement("li");
                li.innerHTML = `⚠️ <b>${task.title}</b> - <small>${task.assigned_to}</small>`;
                if (overdueList) overdueList.appendChild(li);
            }

            // Statü eşleştirmesi
            let statusKey = task.status;
            if (statusKey === "Başlamadı" || statusKey === "Baslamadi") statusKey = "Baslamadi";
            else if (statusKey === "Başlandı" || statusKey === "Baslandi") statusKey = "Baslandi";
            else if (statusKey === "Devam Ediyor" || statusKey === "DevamEdiyor") statusKey = "DevamEdiyor";
            else if (statusKey === "Tamamlandı" || statusKey === "Tamamlandi") statusKey = "Tamamlandi";

            if (counts.hasOwnProperty(statusKey)) {
                counts[statusKey]++;
                const container = document.getElementById(`parent-list-${statusKey}`);
                if (container) {
                    const card = document.createElement("div");
                    card.className = "task-card"; // CSS ile stil verebilirsin
                    card.style = `background:#fff; border:1px solid ${isOverdue ? '#fc8181' : '#eee'}; padding:12px; margin-bottom:12px; border-radius:10px; position:relative; box-shadow:0 2px 4px rgba(0,0,0,0.05);`;
                    
                    // Buton Mantığı: Tamamlandıysa Arşivle, değilse Sil
                    let actionBtn = "";
                    if (statusKey === "Tamamlandi") {
                        actionBtn = `<button onclick="archiveTask(${task.id})" title="Arşive Kaldır" style="position:absolute; top:8px; right:8px; border:none; background:#f1f5f9; cursor:pointer; font-size:14px; padding:4px; border-radius:5px;">📁</button>`;
                    } else {
                        actionBtn = `<button onclick="deleteTask(${task.id})" title="Görevi Sil" style="position:absolute; top:8px; right:8px; border:none; background:none; cursor:pointer; font-size:16px;">🗑️</button>`;
                    }

                    card.innerHTML = `
                        <div style="padding-right:25px;">
                            <b style="color:#2d3748; font-size:0.95rem;">${task.title}</b>
                            <span style="font-size:0.8rem; color:#4facfe; font-weight:bold;"> (+${task.points} GP)</span>
                            <p style="color: #718096; font-size: 0.8rem; margin: 5px 0;">${task.description || ""}</p>
                            <small style="display:block; color:#4a5568; margin-top:5px;">👤 ${task.assigned_to}</small>
                            <small style="color:#a0aec0; font-size: 0.75rem;">📅 ${dateStr}</small>
                        </div>
                        ${actionBtn}
                    `;
                    container.appendChild(card);
                }
            }
        });

        // Sayıları güncelle
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

// script.js içinde bunu kullan (Senin server.js kodunla tam uyumlu)
async function updateTaskStatus(taskId, newStatus) {
    try {
        const res = await fetch("/update-task-status", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ taskId, status: newStatus })
        });

        if (res.ok) {
            // Liste ve puanları yenile (Server tarafında puan eklendiği için bu önemli)
            loadMyTasks();
            if (typeof loadStudentPoints === "function") loadStudentPoints(); 
        } else {
            const errorData = await res.json();
            alert("Hata: " + errorData.message);
        }
    } catch (error) {
        console.error("Güncelleme hatası:", error);
    }
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
async function completeTask(taskId) {
    const res = await fetch("/update-task-status", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ taskId, status: "Tamamlandı" })
    });

    if (res.ok) {
        alert("Görev tamamlandı! Puanın eklendi.");
        loadMyTasks();
        loadStudentPoints();
    }
}
async function saveTaskStatus(taskId) {
    const selectElement = document.getElementById(`select-${taskId}`);
    const newStatus = selectElement.value;

    if (newStatus === "Tamamlandı" && !confirm("Puan kazanmak için onaylıyor musunuz?")) return;

    try {
        const res = await fetch("/update-task-status", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ taskId: parseInt(taskId), status: newStatus })
        });

        if (res.ok) {
            await loadStudentPoints(); 
            await loadMyTasks();
        } else {
            alert("Hata oluştu!");
        }
    } catch (e) { console.error(e); }
}
async function loadStudentPoints() {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    try {
        const response = await fetch(`/user-points/${userId}`, { headers: getAuthHeaders() });
        const data = await response.json();

        const totalXP = data.total_points || 0;
        const balanceGP = data.current_balance || 0;
        const level = Math.floor(totalXP / 200) + 1;

        let rank = "Çaylak Görevci";
        if (totalXP >= 500) rank = "Görev Asistanı";
        if (totalXP >= 1500) rank = "Görev Ustası";
        if (totalXP >= 3000) rank = "Şehir Kahramanı";
        if (totalXP >= 6000) rank = "Efsanevi Görevci 👑";

        if (document.getElementById("user-level")) document.getElementById("user-level").innerText = level;
        if (document.getElementById("user-rank")) document.getElementById("user-rank").innerText = rank;
        if (document.getElementById("total-xp-display")) document.getElementById("total-xp-display").innerText = totalXP;
        if (document.getElementById("total-points")) document.getElementById("total-points").innerText = balanceGP;
        
    } catch (error) { console.error("Puan yükleme hatası:", error); }
}
function toggleArchive() {
    const list = document.getElementById("completedTaskList");
    const chevron = document.getElementById("archive-chevron");
    if (list.style.display === "none") {
        list.style.display = "block";
        chevron.innerText = "▲";
    } else {
        list.style.display = "none";
        chevron.innerText = "▼";
    }
}
function getAuthHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + localStorage.getItem("token")
    };
}
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("taskList")) {
        loadMyTasks();
        loadStudentPoints();
    }
});
async function buyReward(name, cost) {
    if (!confirm(`${name} ödülünü ${cost} GP karşılığında almak istiyor musun?`)) return;

    const res = await fetch("/buy-reward", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ rewardName: name, cost })
    });

    const data = await res.json();
    alert(data.message);
    if (res.ok) {
        loadStudentPoints(); // Bakiyeyi güncelle
    }
}
function showSection(section) {
    const tasksDiv = document.getElementById('section-tasks');
    const marketDiv = document.getElementById('section-market');
    const btnTasks = document.getElementById('btn-tasks');
    const btnMarket = document.getElementById('btn-market');

    if (section === 'market') {
        tasksDiv.style.display = 'none';
        marketDiv.style.display = 'block';
        btnMarket.style.background = '#4facfe';
        btnMarket.style.color = 'white';
        btnTasks.style.background = '#e2e8f0';
        btnTasks.style.color = '#4a5568';
    } else {
        tasksDiv.style.display = 'block';
        marketDiv.style.display = 'none';
        btnTasks.style.background = '#4facfe';
        btnTasks.style.color = 'white';
        btnMarket.style.background = '#e2e8f0';
        btnMarket.style.color = '#4a5568';
    }
}
async function loadPendingPurchases() {
    const parentId = localStorage.getItem("userId");
    const res = await fetch(`/pending-purchases/${parentId}`, { headers: getAuthHeaders() });
    const purchases = await res.json();
    
    const container = document.getElementById("pending-purchases-list");
    if(!container) return;

    container.innerHTML = purchases.length === 0 ? 
        "<p style='color: #718096; text-align:center;'>Şu an onay bekleyen bir ödül yok. 😊</p>" : "";

    purchases.forEach(p => {
        const div = document.createElement("div");
        div.style = "background: white; padding: 15px; border-radius: 12px; margin-bottom: 10px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);";
        div.innerHTML = `
            <div>
                <strong style="color: #2d3748; font-size: 1rem;">🛒 ${p.reward_name}</strong>
                <div style="font-size: 0.8rem; color: #718096; margin-top: 4px;">
                    👤 ${p.student_email} | 💰 <b>${p.cost} GP</b>
                </div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button onclick="approvePurchase(${p.id}, 'Onaylandı')" style="background: #48bb78; color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: bold;">Onayla</button>
                <button onclick="approvePurchase(${p.id}, 'Reddedildi')" style="background: #f56565; color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: bold;">Reddet</button>
            </div>
        `;
        container.appendChild(div);
    });
}
async function approvePurchase(purchaseId, status) {
    const res = await fetch("/update-purchase-status", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ purchaseId, status })
    });
    if (res.ok) {
        loadPendingPurchases();
        alert(`Ödül ${status}!`);
    }
}
function toggleLevelTable() {
    const table = document.getElementById("levelTable");
    const currentXp = document.getElementById("total-xp-display")?.innerText || "0"; // Mevcut XP'yi al
    const infoBox = document.getElementById("current-xp-info");
    
    if (infoBox) infoBox.innerText = currentXp; // Tablo altındaki kutuya yaz

    if (table.style.display === "none" || table.style.display === "") {
        table.style.display = "block";
        table.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        table.style.display = "none";
    }
}
async function archiveTask(taskId) {
    if (!confirm("Bu görev listenizden kaldırılacak ama öğrencinin geçmişinde saklanmaya devam edecek. Onaylıyor musunuz?")) return;

    const res = await fetch("/archive-task-parent", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ taskId })
    });

    if (res.ok) {
        loadTasks(); // Veli listesini yenile
    }
}
let cart = []; // Sepeti tutan dizi

function addToCart(rewardName, cost) {
    cart.push({ rewardName, cost });
    updateCartUI();
    console.log(`🛒 Sepete eklendi: ${rewardName}`);
}
function updateCartUI() {
    const cartItemsElement = document.getElementById("cart-items");
    const cartTotalElement = document.getElementById("cart-total");
    const checkoutBtn = document.getElementById("checkout-btn");

    if (!cartItemsElement) return;

    cartItemsElement.innerHTML = "";
    let total = 0;

    cart.forEach((item, index) => {
        total += item.cost;
        const div = document.createElement("div");
        div.style = "display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 0.9rem; background: #f8fafc; padding: 5px 10px; border-radius: 5px;";
        div.innerHTML = `
            <span>${item.rewardName}</span>
            <span style="font-weight: bold; color: #4facfe;">${item.cost} GP 
                <button onclick="removeFromCart(${index})" style="background:none; border:none; color:red; cursor:pointer; margin-left:5px;">✕</button>
            </span>
        `;
        cartItemsElement.appendChild(div);
    });

    cartTotalElement.innerText = total;
    checkoutBtn.disabled = cart.length === 0;
}
function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
}
async function checkout() {
    const totalCost = cart.reduce((sum, item) => sum + item.cost, 0);
    const userId = localStorage.getItem("userId");

    // Mevcut puan kontrolü
    const currentPoints = parseInt(document.getElementById("current-balance-display").innerText);
    if (totalCost > currentPoints) {
        alert("Yetersiz GP! Daha fazla görev yapmalısın. 💪");
        return;
    }

    if (!confirm(`${totalCost} GP karşılığında sepeti onaylıyor musunuz?`)) return;

    try {
        const res = await fetch("/checkout", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ userId, items: cart, totalCost })
        });

        if (res.ok) {
            alert("Sepet onay için veliye gönderildi! 🚀");
            cart = [];
            updateCartUI();
            loadStudentPoints(); // Puanları yenile
        }
    } catch (error) {
        console.error("Checkout hatası:", error);
    }
}