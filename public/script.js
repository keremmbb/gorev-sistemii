// -------------------- 1. GENEL AYARLAR & AUTH --------------------
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

function fixDate(dateSource) {
    if (!dateSource) return "Belirtilmedi";
    const date = new Date(dateSource);
    if (isNaN(date.getTime())) return "Geçersiz Tarih";
    return date.toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul",
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}

// -------------------- 2. ÖĞRENCİ PANELİ FONKSİYONLARI --------------------
async function loadMyTasks() {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    const res = await fetch(`/my-tasks/${userId}`, { headers: getAuthHeaders() });
    const tasks = await res.json();
    
    const taskList = document.getElementById("taskList");
    const completedTaskList = document.getElementById("completedTaskList");
    const completedCountLabel = document.getElementById("completed-count");

    if (!taskList) return; 

    taskList.innerHTML = "";
    completedTaskList.innerHTML = "";
    let doneCounter = 0;

    tasks.forEach(task => {
        const li = document.createElement("li");
        if (task.status === "Tamamlandı") {
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

async function updateTaskStatus(taskId, newStatus) {
    if (newStatus === "Tamamlandı" && !confirm("Puan kazanmak için görevi bitirdiğini onaylıyor musun?")) return;
    
    try {
        const res = await fetch("/update-task-status", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ taskId, status: newStatus })
        });
        if (res.ok) {
            loadMyTasks();
            loadStudentPoints();
        }
    } catch (error) { console.error("Hata:", error); }
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

// -------------------- 3. SEPET & MARKET SİSTEMİ --------------------
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

    cartItemsElement.innerHTML = cart.length === 0 ? 
        '<p style="color: #a0aec0; font-size: 0.85rem; text-align: center;">Sepetiniz şu an boş.</p>' : "";
    
    let total = 0;
    cart.forEach((item) => {
        const itemTotal = item.cost * item.quantity;
        total += itemTotal;
        const div = document.createElement("div");
        div.style = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; background: #f8fafc; padding: 8px 12px; border-radius: 10px; border: 1px solid #edf2f7;";
        div.innerHTML = `
            <div style="display: flex; flex-direction: column;">
                <span style="font-weight: bold; color: #2d3748; font-size: 0.9rem;">${item.rewardName}</span>
                <span style="font-size: 0.75rem; color: #718096;">${item.cost} GP x ${item.quantity}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-weight: 800; color: #4facfe;">${itemTotal} GP</span>
                <button onclick="removeFromCart('${item.rewardName}')" style="background: #fff5f5; border: 1px solid #feb2b2; color: #e53e3e; cursor: pointer; border-radius: 5px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold;">-</button>
            </div>
        `;
        cartItemsElement.appendChild(div);
    });

    if(cartTotalElement) cartTotalElement.innerText = total;
    if(checkoutBtn) checkoutBtn.disabled = cart.length === 0;
}

async function checkout() {
    const totalCost = cart.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
    const userId = localStorage.getItem("userId");
    const currentPoints = parseInt(document.getElementById("total-points").innerText);

    if (totalCost > currentPoints) {
        alert("Yetersiz GP! Biraz daha görev tamamlamalısın. 💪");
        return;
    }

    if (!confirm(`Toplam ${totalCost} GP tutarındaki sepeti onaylıyor musunuz?`)) return;

    try {
        const res = await fetch("/checkout", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ userId, items: cart, totalCost })
        });

        if (res.ok) {
            alert("Harika! Talebin veline iletildi. 🚀");
            cart = [];
            updateCartUI();
            loadStudentPoints(); 
        }
    } catch (error) { alert("Bir hata oluştu."); }
}

// -------------------- 4. VELİ PANELİ FONKSİYONLARI --------------------
async function loadMyAssignedTasks() {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    const res = await fetch(`/my-assigned-tasks/${userId}`, { headers: getAuthHeaders() });
    const tasks = await res.json();
    
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
        const dateStr = fixDate(task.due_date);
        const dueDateObj = new Date(task.due_date);
        const isOverdue = dueDateObj < new Date() && task.status !== "Tamamlandı";

        if (isOverdue) {
            overdueCount++;
            const li = document.createElement("li");
            li.innerHTML = `⚠️ <b>${task.title}</b> - <small>${task.assigned_to}</small>`;
            if (overdueList) overdueList.appendChild(li);
        }

        let statusKey = task.status.replace(/\s/g, ''); 
        if (statusKey === "Başlamadı") statusKey = "Baslamadi";
        if (statusKey === "Başlandı") statusKey = "Baslandi";

        if (counts.hasOwnProperty(statusKey)) {
            counts[statusKey]++;
            const container = document.getElementById(`parent-list-${statusKey}`);
            if (container) {
                const card = document.createElement("div");
                card.style = `background:#fff; border:1px solid ${isOverdue ? '#fc8181' : '#eee'}; padding:12px; margin-bottom:12px; border-radius:10px; position:relative; box-shadow:0 2px 4px rgba(0,0,0,0.05);`;
                
                let actionBtn = statusKey === "Tamamlandi" ? 
                    `<button onclick="archiveTask(${task.id})" title="Arşive Kaldır" style="position:absolute; top:8px; right:8px; border:none; background:#f1f5f9; cursor:pointer; padding:4px; border-radius:5px;">📁</button>` :
                    `<button onclick="deleteTask(${task.id})" title="Görevi Sil" style="position:absolute; top:8px; right:8px; border:none; background:none; cursor:pointer; font-size:16px;">🗑️</button>`;

                card.innerHTML = `
                    <div style="padding-right:25px;">
                        <b style="color:#2d3748;">${task.title}</b>
                        <span style="font-size:0.8rem; color:#4facfe; font-weight:bold;"> (+${task.points} GP)</span>
                        <p style="color: #718096; font-size: 0.8rem; margin: 5px 0;">${task.description || ""}</p>
                        <small style="display:block; color:#4a5568;">👤 ${task.assigned_to}</small>
                        <small style="color:#a0aec0;">📅 ${dateStr}</small>
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

    const overduePanel = document.getElementById("overdue-panel");
    if (overduePanel) overduePanel.style.display = overdueCount > 0 ? "block" : "none";
}

async function loadPendingPurchases() {
    const parentId = localStorage.getItem("userId");
    const res = await fetch(`/pending-purchases/${parentId}`, { headers: getAuthHeaders() });
    const purchases = await res.json();
    
    const container = document.getElementById("pending-purchases-list");
    if(!container) return;

    container.innerHTML = purchases.length === 0 ? "<p style='text-align:center; color:#718096;'>Bekleyen ödül yok.</p>" : "";

    purchases.forEach(p => {
        const div = document.createElement("div");
        div.style = "background: white; padding: 15px; border-radius: 12px; margin-bottom: 10px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;";
        div.innerHTML = `
            <div><strong>🛒 ${p.reward_name}</strong><br><small>${p.student_email} | ${p.cost} GP</small></div>
            <div style="display: flex; gap: 8px;">
                <button onclick="approvePurchase(${p.id}, 'Onaylandı')" style="background: #48bb78; color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer;">Onayla</button>
                <button onclick="approvePurchase(${p.id}, 'Reddedildi')" style="background: #f56565; color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer;">Reddet</button>
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
    if (res.ok) { loadPendingPurchases(); alert(`Ödül ${status}!`); }
}

// -------------------- 5. SAYFA KONTROLLERİ --------------------
function showSection(section) {
    document.getElementById('section-tasks').style.display = section === 'market' ? 'none' : 'block';
    document.getElementById('section-market').style.display = section === 'market' ? 'block' : 'none';
    
    const btnMarket = document.getElementById('btn-market');
    const btnTasks = document.getElementById('btn-tasks');
    if(btnMarket && btnTasks) {
        btnMarket.style.background = section === 'market' ? '#4facfe' : '#e2e8f0';
        btnMarket.style.color = section === 'market' ? 'white' : '#4a5568';
        btnTasks.style.background = section === 'market' ? '#e2e8f0' : '#4facfe';
        btnTasks.style.color = section === 'market' ? '#4a5568' : 'white';
    }
}

function toggleLevelTable() {
    const table = document.getElementById("levelTable");
    if (!table) return;
    const currentXp = document.getElementById("total-xp-display")?.innerText || "0";
    if (document.getElementById("current-xp-info")) document.getElementById("current-xp-info").innerText = currentXp;
    table.style.display = (table.style.display === "none" || table.style.display === "") ? "block" : "none";
}

function toggleArchive() {
    const list = document.getElementById("completedTaskList");
    const chevron = document.getElementById("archive-chevron");
    if (!list) return;
    const isHidden = list.style.display === "none";
    list.style.display = isHidden ? "block" : "none";
    if(chevron) chevron.innerText = isHidden ? "▲" : "▼";
}

// -------------------- 6. INITIALIZE (YÜKLEME) --------------------
document.addEventListener("DOMContentLoaded", () => {
    const role = localStorage.getItem("role");
    
    // Öğrenci Sayfası
    if (document.getElementById("taskList")) {
        loadMyTasks();
        loadStudentPoints();
    }
    
    // Veli Sayfası
    if (document.getElementById("parent-list-Baslamadi")) {
        loadMyAssignedTasks();
        loadPendingPurchases();
    }
});