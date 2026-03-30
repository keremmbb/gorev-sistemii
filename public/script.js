// -------------------- GENEL AYARLAR & AUTH --------------------
function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}

function getAuthHeaders() {
    const token = localStorage.getItem("token");
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
    };
}

// -------------------- ÖĞRENCİ FONKSİYONLARI --------------------
async function loadMyTasks() {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    try {
        const res = await fetch(`/my-tasks/${userId}`, { headers: getAuthHeaders() });
        const tasks = await res.json();
        
        const taskList = document.getElementById("taskList");
        const completedTaskList = document.getElementById("completedTaskList");
        
        if (taskList) taskList.innerHTML = "";
        if (completedTaskList) completedTaskList.innerHTML = "";
        let doneCounter = 0;

        tasks.forEach(task => {
            const li = document.createElement("li");
            // ... (Buradaki mevcut li oluşturma kodların aynen kalıyor)
            
            if (task.status === "Tamamlandı") {
                doneCounter++;
                if (completedTaskList) completedTaskList.appendChild(li);
            } else {
                if (taskList) taskList.appendChild(li);
            }
        });

        if (document.getElementById("completed-count")) {
            document.getElementById("completed-count").innerText = doneCounter;
        }

        // --- İŞTE EKLEDİĞİMİZ KRİTİK SATIR ---
        loadRejectedPurchases(); 
        // -------------------------------------

    } catch (error) {
        console.error("Görevler yüklenirken hata:", error);
    }
}

async function updateTaskStatus(taskId, newStatus) {
    if (newStatus === "Tamamlandı" && !confirm("Puan kazanmak için görevi tamamladığınızı onaylıyor musunuz?")) {
        loadMyTasks(); // Seçimi eski haline döndürmek için listeyi yenile
        return;
    }

    try {
        const res = await fetch("/update-task-status", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ taskId, status: newStatus })
        });

        if (res.ok) {
            await loadMyTasks();
            await loadStudentPoints(); 
        } else {
            const errorData = await res.json();
            alert("Hata: " + errorData.message);
        }
    } catch (error) { console.error("Güncelleme hatası:", error); }
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

// -------------------- VELİ FONKSİYONLARI (KANBAN & YÖNETİM) --------------------
async function loadMyAssignedTasks() {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    try {
        const res = await fetch(`/my-assigned-tasks/${userId}`, { headers: getAuthHeaders() });
        const tasks = await res.json();
        
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
            const dateStr = fixDate(task.due_date);
            const dueDateObj = task.due_date ? new Date(task.due_date) : null;
            const isOverdue = dueDateObj && dueDateObj < new Date() && task.status !== "Tamamlandı";

            if (isOverdue) {
                overdueCount++;
                const li = document.createElement("li");
                li.innerHTML = `⚠️ <b>${task.title}</b> - <small>${task.assigned_to} (${dateStr})</small>`;
                if (overdueList) overdueList.appendChild(li);
            }

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
                    card.style = `background:#fff; border:1px solid ${isOverdue ? '#fc8181' : '#eee'}; padding:12px; margin-bottom:12px; border-radius:10px; position:relative; box-shadow:0 2px 4px rgba(0,0,0,0.05);`;
                    
                    let actionBtn = (statusKey === "Tamamlandi") 
                        ? `<button onclick="archiveTask(${task.id})" title="Arşive Kaldır" style="position:absolute; top:8px; right:8px; border:none; background:#f1f5f9; cursor:pointer; font-size:14px; padding:4px; border-radius:5px;">📁</button>`
                        : `<button onclick="deleteTask(${task.id})" title="Görevi Sil" style="position:absolute; top:8px; right:8px; border:none; background:none; cursor:pointer; font-size:16px;">🗑️</button>`;

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

        columns.forEach(id => {
            const countEl = document.getElementById(`count-${id}`);
            if (countEl) countEl.innerText = counts[id];
        });

        if (overduePanel) overduePanel.style.display = overdueCount > 0 ? "block" : "none";
    } catch (e) { console.error(e); }
}

async function addTask() {
    const title = document.getElementById("taskTitle").value.trim();
    const description = document.getElementById("taskDescription").value.trim();
    const assignedToEmail = document.getElementById("assignedToEmail").value.trim();
    const dueDate = document.getElementById("dueDate").value;
    const dueTime = document.getElementById("dueTime").value;
    const points = document.getElementById("taskPoints")?.value || 10;

    if (!title || !assignedToEmail || !dueDate || !dueTime) return alert("Lütfen tüm alanları doldurun.");

    try {
        const userRes = await fetch(`/get-user-id?email=${assignedToEmail}`, { headers: getAuthHeaders() });
        const userData = await userRes.json();
        if (!userData.userId) return alert("Bu mail adresine sahip bir öğrenci bulunamadı!");

        const fullIsoDate = `${dueDate}T${dueTime}:00`;

        const response = await fetch("/add-task", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                title, description, assignedTo: userData.userId, assignedBy: localStorage.getItem("userId"),
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

async function archiveTask(taskId) {
    if (!confirm("Bu görev listenizden kaldırılacak ama öğrencinin geçmişinde kalacaktır. Onaylıyor musunuz?")) return;
    try {
        const res = await fetch("/archive-task-parent", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ taskId })
        });
        if (res.ok) loadMyAssignedTasks(); // İsmi düzelttim
    } catch (e) { console.error(e); }
}

// -------------------- MARKET & SEPET SİSTEMİ --------------------
let cart = [];

function addToCart(rewardName, cost) {
    const existingItem = cart.find(item => item.rewardName === rewardName);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ rewardName, cost, quantity: 1 });
    }
    updateCartUI();
}

function removeFromCart(rewardName) {
    const itemIndex = cart.findIndex(item => item.rewardName === rewardName);
    if (itemIndex > -1) {
        if (cart[itemIndex].quantity > 1) {
            cart[itemIndex].quantity -= 1;
        } else {
            cart.splice(itemIndex, 1);
        }
    }
    updateCartUI();
}

function updateCartUI() {
    const cartItemsElement = document.getElementById("cart-items");
    const cartTotalElement = document.getElementById("cart-total");
    const checkoutBtn = document.getElementById("checkout-btn");

    if (!cartItemsElement) return;
    cartItemsElement.innerHTML = cart.length === 0 ? '<p style="color: #a0aec0; text-align: center;">Sepetiniz boş.</p>' : "";
    
    let total = 0;
    cart.forEach((item) => {
        const itemTotal = item.cost * item.quantity;
        total += itemTotal;
        const div = document.createElement("div");
        div.style = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; background: #f8fafc; padding: 8px 12px; border-radius: 10px; border: 1px solid #edf2f7;";
        div.innerHTML = `
            <div style="display: flex; flex-direction: column;">
                <span style="font-weight: bold; font-size: 0.9rem;">${item.rewardName}</span>
                <span style="font-size: 0.75rem; color: #718096;">${item.cost} GP x ${item.quantity}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-weight: 800; color: #4facfe;">${itemTotal} GP</span>
                <button onclick="removeFromCart('${item.rewardName}')" style="background:#fff5f5; border:1px solid #feb2b2; color:#e53e3e; cursor:pointer; width:24px; border-radius:5px;">-</button>
            </div>`;
        cartItemsElement.appendChild(div);
    });

    if (cartTotalElement) cartTotalElement.innerText = total;
    if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;
}

async function checkout() {
    const totalCost = cart.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
    const currentPoints = parseInt(document.getElementById("total-points")?.innerText || 0);

    if (totalCost > currentPoints) return alert("Yetersiz GP! Daha fazla görev yapmalısın. 💪");
    if (!confirm(`Toplam ${totalCost} GP tutarındaki sepeti onaylıyor musunuz?`)) return;

    try {
        const res = await fetch("/checkout", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ userId: localStorage.getItem("userId"), items: cart, totalCost })
        });

        if (res.ok) {
            alert("Talebiniz velinize iletildi! 🚀");
            cart = [];
            updateCartUI();
            loadStudentPoints();
        }
    } catch (error) { alert("Bir hata oluştu."); }
}

// -------------------- KAYIT & GİRİŞ --------------------
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

// -------------------- YARDIMCI FONKSİYONLAR --------------------
function fixDate(dateSource) {
    if (!dateSource) return "Belirtilmedi";
    const date = new Date(dateSource);
    if (isNaN(date.getTime())) return "Geçersiz Tarih";
    return date.toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul", year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
}

function showSection(section) {
    const tasksDiv = document.getElementById('section-tasks');
    const marketDiv = document.getElementById('section-market');
    if (tasksDiv && marketDiv) {
        tasksDiv.style.display = (section === 'tasks') ? 'block' : 'none';
        marketDiv.style.display = (section === 'market') ? 'block' : 'none';
    }
}

// -------------------- SAYFA YÜKLENDİĞİNDE --------------------
document.addEventListener("DOMContentLoaded", () => {
    const role = localStorage.getItem("role")?.toLowerCase();

    // 1. Eğer öğrenciyse görevlerini ve puanlarını yükle
    if (document.getElementById("taskList")) {
        loadMyTasks();
        loadStudentPoints();
    }

    // 2. Eğer veliyse Kanban tahtasını ve ONAY LİSTESİNİ yükle
    if (document.getElementById("parent-list-Baslamadi") || document.getElementById("pending-purchases-list")) {
        loadMyAssignedTasks();
        loadPendingPurchases(); // <--- İşte eksik olan tetikleyici buydu!
    }

    // Davet kodu kontrolü (Önceki kodun devamı)
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get("invite");
    if (inviteToken && document.getElementById("email")) {
        fetch(`/check-invite?invite=${inviteToken}`)
            .then(res => res.json())
            .then(data => {
                if (data.valid) {
                    document.getElementById("email").value = data.email;
                    localStorage.setItem("registerRole", "student");
                    if (document.getElementById("roleText")) document.getElementById("roleText").innerText = "Öğrenci (Davetli)";
                }
            });
    }
});
async function loadPendingPurchases() {
    const parentId = localStorage.getItem("userId");
    if (!parentId) return;

    try {
        const res = await fetch(`/pending-purchases/${parentId}`, { headers: getAuthHeaders() });
        const purchases = await res.json();
        
        const container = document.getElementById("pending-purchases-list");
        if (!container) return;

        // Listeyi temizle ve eğer onay bekleyen ödül yoksa mesaj göster
        if (!purchases || purchases.length === 0) {
            container.innerHTML = `
                <div id="no-reward-msg" style="text-align: center; padding: 20px; background: #fff; border-radius: 12px; border: 1px dashed #cbd5e0;">
                    <p style="color: #718096; margin: 0; font-size: 0.9rem;">Şu an onay bekleyen bir ödül yok. 😊</p>
                </div>`;
            return;
        }

        container.innerHTML = ""; // İçeriği temizle

        purchases.forEach(p => {
            const div = document.createElement("div");
            // Veli için kart tasarımı
            div.style = "background: white; padding: 15px; border-radius: 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);";
            
            div.innerHTML = `
                <div>
                    <strong style="color: #2d3748; font-size: 1rem;">🛒 ${p.reward_name}</strong>
                    <div style="font-size: 0.8rem; color: #718096; margin-top: 4px;">
                        👤 ${p.student_email} | 💰 <b style="color: #4facfe;">${p.cost} GP</b>
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="approvePurchase(${p.id}, 'Onaylandı')" 
                        style="background: #48bb78; color: white; border: none; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s;">
                        Onayla
                    </button>
                    <button onclick="approvePurchase(${p.id}, 'Reddedildi')" 
                        style="background: #ed8936; color: white; border: none; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s;">
                        İade Et
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
    } catch (error) {
        console.error("Onay listesi yüklenirken hata:", error);
    }
}
async function approvePurchase(purchaseId, status) {
    try {
        const res = await fetch("/update-purchase-status", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ purchaseId, status })
        });
        
        if (res.ok) {
            alert(`Ödül talebi ${status}!`);
            loadPendingPurchases(); // Listeyi anlık güncelle
            if (typeof loadMyAssignedTasks === "function") loadMyAssignedTasks(); // Varsa puanları/tabloyu güncelle
        } else {
            alert("İşlem sırasında bir hata oluştu.");
        }
    } catch (error) {
        console.error("Onay hatası:", error);
    }
}
async function loadRejectedPurchases() {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    try {
        const res = await fetch(`/rejected-purchases/${userId}`, { 
            headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` } 
        });
        const rejectedItems = await res.json();
        
        const container = document.getElementById("rejected-rewards-list");
        const section = document.getElementById("section-rejected-rewards");

        if (!rejectedItems || rejectedItems.length === 0) {
            if (section) section.style.display = "none";
            return;
        }

        if (section) section.style.display = "block";
        container.innerHTML = ""; 

        rejectedItems.forEach(item => {
            const div = document.createElement("div");
            div.style = "background: white; padding: 12px; border-radius: 12px; margin-bottom: 8px; border: 1px solid #feb2b2; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);";
            div.innerHTML = `
                <div>
                    <strong style="color: #c53030;">❌ Reddedildi: ${item.reward_name}</strong>
                    <div style="font-size: 0.75rem; color: #718096;">${item.cost} GP hesabınıza iade edildi.</div>
                </div>
                <button onclick="dismissRejected(${item.id})" style="background: #fed7d7; border: none; color: #c53030; cursor: pointer; border-radius: 6px; padding: 5px 8px; font-weight: bold;">Kapat</button>
            `;
            container.appendChild(div);
        });
    } catch (error) {
        console.error("Reddedilenler yüklenemedi:", error);
    }
}
async function dismissRejected(id) {
    try {
        const res = await fetch(`/clear-rejected-purchase/${id}`, { 
            method: 'DELETE',
            headers: getAuthHeaders() 
        });
        
        if (res.ok) {
            // Başarılıysa hem listeyi hem puanları tazele
            loadRejectedPurchases();
            loadStudentPoints(); 
        } else {
            console.error("Silme işlemi başarısız oldu.");
        }
    } catch (error) {
        console.error("Silme hatası:", error);
    }
}