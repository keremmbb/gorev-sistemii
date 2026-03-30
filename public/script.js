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
            li.style = "background: white; padding: 15px; border-radius: 15px; margin-bottom: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #edf2f7; display: flex; justify-content: space-between; align-items: center;";
            
            // Tarih ve Puan bilgisini hazırla
            const dateStr = fixDate(task.due_date);
            
            li.innerHTML = `
                <div style="flex: 1;">
                    <div style="font-weight: bold; color: #2d3748; font-size: 1rem;">${task.title}</div>
                    <div style="font-size: 0.75rem; color: #718096; margin-top: 4px;">
                        📅 ${dateStr} | 💰 <span style="color: #4facfe; font-weight: bold;">${task.points} GP</span>
                    </div>
                </div>
                <div>
                    <select class="status-select" onchange="updateTaskStatus(${task.id}, this.value)">
                        <option value="Baslamadi" ${task.status === 'Baslamadi' ? 'selected' : ''}>⏳ Başlamadı</option>
                        <option value="Baslandi" ${task.status === 'Baslandi' ? 'selected' : ''}>🚀 Başlandı</option>
                        <option value="DevamEdiyor" ${task.status === 'DevamEdiyor' ? 'selected' : ''}>🔄 Devam Ediyor</option>
                        <option value="Tamamlandı" ${task.status === 'Tamamlandı' ? 'selected' : ''}>✅ Tamamlandı</option>
                    </select>
                </div>
            `;
            
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

        loadRejectedPurchases(); 

    } catch (error) {
        console.error("Görevler yüklenirken hata:", error);
    }
}

async function updateTaskStatus(taskId, newStatus) {
    try {
        const res = await fetch("/update-task-status", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ taskId, status: newStatus })
        });

        if (res.ok) {
            console.log(`Görev ${taskId} durumu ${newStatus} olarak güncellendi.`);
            
            // 1. Listeleri yenile (Öğrenci veya Veli panelindeysen ilgili listeyi çeker)
            if (typeof loadMyTasks === "function") await loadMyTasks();
            if (typeof loadMyAssignedTasks === "function") await loadMyAssignedTasks();
            if (typeof loadStudentPoints === "function") await loadStudentPoints();

            // 2. GRAFİĞİ GÜNCELLE: 
            // Veli panelindeysek ve bir öğrenci seçiliyse grafiği yenile
            const lastStudentId = localStorage.getItem("lastViewedStudentId");
            if (lastStudentId && typeof loadStatistics === "function") {
                console.log("Grafik güncelleniyor...");
                loadStatistics(lastStudentId);
            }
        } else {
            const err = await res.json();
            alert("Hata: " + err.message);
        }
    } catch (error) {
        console.error("Durum güncelleme hatası:", error);
    }
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
    const title = document.getElementById("taskTitle").value;
    const description = document.getElementById("taskDescription").value;
    const assignedTo = document.getElementById("assignedToEmail").value;
    const dueDate = document.getElementById("dueDate").value;
    const dueTime = document.getElementById("dueTime").value;
    const points = document.getElementById("taskPoints").value;

    if (!title || !assignedTo) {
        alert("Lütfen en azından başlık ve öğrenci e-postasını doldurun.");
        return;
    }

    // Tarih ve saati birleştir
    const fullDueDate = (dueDate && dueTime) ? `${dueDate}T${dueTime}` : null;

    try {
        const res = await fetch("/add-task", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ 
                title, 
                description, 
                assignedTo, 
                dueDate: fullDueDate,
                points: points || 10
            })
        });

        if (res.ok) {
            const data = await res.json();
            alert("Görev başarıyla eklendi!");

            // Formu temizle
            document.getElementById("taskTitle").value = "";
            document.getElementById("taskDescription").value = "";
            document.getElementById("dueDate").value = "";
            document.getElementById("dueTime").value = "";

            // Grafiği güncellemek için öğrenci ID'sini kaydet ve çalıştır
            if (data.studentId) {
                localStorage.setItem("lastViewedStudentId", data.studentId);
                loadStatistics(data.studentId);
            }

            // Listeyi yenile (Veli panelindeki kanban tahtası için)
            if (typeof loadMyAssignedTasks === "function") {
                loadMyAssignedTasks();
            }
        } else {
            const err = await res.json();
            alert("Hata: " + err.message);
        }
    } catch (error) {
        console.error("Görev ekleme hatası:", error);
        alert("Sunucuya bağlanılamadı.");
    }
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
    const userId = localStorage.getItem("userId");
    const token = localStorage.getItem("token");

    if (!cart || cart.length === 0) {
        alert("Sepetiniz boş!");
        return;
    }

    // Toplam maliyeti doğru hesapla
    const totalCost = cart.reduce((sum, item) => sum + (item.cost * item.quantity), 0);

    try {
        // Sepetteki ürünleri tek tek diziye açıyoruz (5 adet varsa 5 ayrı nesne yapar)
        let flatItems = [];
        cart.forEach(item => {
            for(let i = 0; i < item.quantity; i++) {
                flatItems.push({
                    rewardName: item.rewardName, // 'name' değil 'rewardName' olmalı
                    cost: item.cost
                });
            }
        });

        const res = await fetch("/checkout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({
                userId: userId,
                items: flatItems, // Artık burada gerçekten kaç tane eklendiyse o kadar ürün var
                totalCost: totalCost
            })
        });

        if (res.ok) {
            alert(`Harika! ${flatItems.length} adet ödül veli onayına gönderildi.`);
            cart = []; // Sepeti boşalt
            updateCartUI();
            loadStudentPoints(); 
        } else {
            const err = await res.json();
            alert("Hata: " + err.message);
        }
    } catch (error) {
        console.error("Satın alma hatası:", error);
    }
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

        if (!purchases || purchases.length === 0) {
            container.innerHTML = `
                <div id="no-reward-msg" style="text-align: center; padding: 20px; background: #fff; border-radius: 12px; border: 1px dashed #cbd5e0;">
                    <p style="color: #718096; margin: 0; font-size: 0.9rem;">Şu an onay bekleyen bir ödül yok. 😊</p>
                </div>`;
            return;
        }

        container.innerHTML = ""; 

        purchases.forEach(p => {
            const div = document.createElement("div");
            div.style = "background: white; padding: 15px; border-radius: 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);";
            
            // ... (loadPendingPurchases içindeki döngü kısmı)
                          div.innerHTML = `
                      <div>
                        <strong style="color: #2d3748;">🛒 ${p.reward_name}</strong>
                       <div style="font-size: 0.8rem; color: #718096;">💰 <b>${p.cost} GP</b></div>
                </div>
                     <div style="display: flex; gap: 8px;">
                    <button onclick="approvePurchase(${p.id}, 'Onaylandı')" 
                         style="background: #48bb78; color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer;">
                       Onayla
                        </button>
                      <button onclick="approvePurchase(${p.id}, 'Reddedildi')" 
                       style="background: #f56565; color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer;">
                      Reddet
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
    let reason = ""; // Varsayılan boş açıklama

    if (status === "Reddedildi") {
        const userInput = prompt("Reddetme nedenini yazar mısınız? (İsteğe bağlı)");
        
        // Eğer kullanıcı 'İptal'e basarsa (userInput === null) işlemi durdur
        if (userInput === null) return; 
        
        reason = userInput; // Kullanıcı bir şey yazdıysa veya boş bırakıp 'Tamam' dediyse ata
    }

    try {
        const res = await fetch("/update-purchase-status", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ 
                purchaseId: purchaseId, 
                status: status, 
                reason: reason // Boş da olsa gönderiyoruz
            })
        });
        
        if (res.ok) {
            alert(status === "Reddedildi" ? "Ödül reddedildi." : "Ödül onaylandı!");
            loadPendingPurchases(); // Listeyi yenile
            if (typeof loadStudentPoints === "function") loadStudentPoints();
        } else {
            const err = await res.json();
            alert("Hata: " + err.message);
        }
    } catch (error) {
        console.error("Onaylama/Reddetme Hatası:", error);
        alert("Sunucuya bağlanılamadı.");
    }
}
async function loadRejectedPurchases() {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    try {
        const res = await fetch(`/rejected-purchases/${userId}`, { headers: getAuthHeaders() });
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
            div.style = "background: white; padding: 15px; border-radius: 12px; margin-bottom: 10px; border: 1px solid #feb2b2; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);";
            
            // Veli notu varsa göster, yoksa standart iade bilgisini göster
            const noteBox = item.rejection_reason 
                ? `<div style="background: #fff5f5; padding: 10px; border-left: 4px solid #f56565; color: #c53030; font-size: 0.85rem; border-radius: 4px;">
                    <strong>Veli Notu:</strong> "${item.rejection_reason}"
                   </div>`
                : `<div style="font-size: 0.8rem; color: #718096;">💰 Tutar hesabınıza iade edildi.</div>`;

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong style="color: #c53030;">❌ Reddedildi: ${item.reward_name}</strong>
                    <button onclick="dismissRejected(${item.id})" style="background: #fed7d7; border: none; color: #c53030; cursor: pointer; border-radius: 6px; padding: 5px 12px; font-weight: bold; font-size: 0.8rem;">Tamam</button>
                </div>
                ${noteBox}
            `;
            container.appendChild(div);
        });
    } catch (error) {
        console.error("Yükleme hatası:", error);
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
async function loadStatistics(studentId) {
    try {
        const res = await fetch(`/user-stats/${studentId}`, { headers: getAuthHeaders() });
        const data = await res.json();

        const labels = data.map(item => item.gun);
        const values = data.map(item => item.miktar);

        const ctx = document.getElementById('myChart').getContext('2d');
        
        // Eğer daha önce bir grafik varsa onu yok et (yenileme hatasını önler)
        if (window.myChartInstance) {
            window.myChartInstance.destroy();
        }

        window.myChartInstance = new Chart(ctx, {
            type: 'line', // Çizgi grafiği
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tamamlanan Görevler',
                    data: values,
                    borderColor: '#4facfe',
                    backgroundColor: 'rgba(79, 172, 254, 0.1)',
                    borderWidth: 3,
                    tension: 0.4, // Çizgiyi kavisli yapar
                    fill: true,
                    pointBackgroundColor: '#4facfe'
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } },
                    x: { grid: { display: false } }
                }
            }
        });
    } catch (error) {
        console.error("Grafik yüklenemedi:", error);
    }
}
function showSection(section) {
    const tasksDiv = document.getElementById('section-tasks');
    const marketDiv = document.getElementById('section-market');
    const btnTasks = document.getElementById('btn-tasks');
    const btnMarket = document.getElementById('btn-market');

    if (section === 'tasks') {
        tasksDiv.style.display = 'block';
        marketDiv.style.display = 'none';
        btnTasks.style.background = '#4facfe';
        btnTasks.style.color = 'white';
        btnMarket.style.background = '#e2e8f0';
        btnMarket.style.color = '#4a5568';
    } else {
        tasksDiv.style.display = 'none';
        marketDiv.style.display = 'block';
        btnTasks.style.background = '#e2e8f0';
        btnTasks.style.color = '#4a5568';
        btnMarket.style.background = '#4facfe';
        btnMarket.style.color = 'white';
    }
}
// Sayfa yüklendiğinde grafiği çizdir
window.addEventListener('load', () => {
    // Eğer bir öğrenci e-postası veya ID'si sabitse onu kullanın
    // Örnek: İlk görevin atandığı öğrenciyi çekebiliriz veya velinin seçtiği öğrenciyi.
    // Şimdilik test için manuel bir ID veya dinamik seçim yapmalısın.
    const lastAssignedStudentId = localStorage.getItem("lastStudentId"); 
    if(lastAssignedStudentId) loadStatistics(lastAssignedStudentId);
});
// script.js dosyasının en sonuna ekle
async function checkAndLoadStats() {
    // Veli panelinde atanan görevlerden birinden öğrenci ID'sini kapalım
    // veya yerel depolamada saklanan bir ID varsa onu kullanalım
    const studentId = localStorage.getItem("lastViewedStudentId"); 
    if (studentId) {
        loadStatistics(studentId);
    } else {
        console.log("Grafik için henüz bir öğrenci ID'si seçilmedi.");
    }
}
async function loadStatsByEmail() {
    const email = document.getElementById("statsSearchEmail").value;
    if (!email) {
        alert("Lütfen bir öğrenci e-postası girin.");
        return;
    }

    try {
        // Önce bu mail adresine sahip öğrencinin ID'sini bulalım
        // Not: Mevcut /add-task rotasındaki mantığı kullanarak küçük bir sorgu yapıyoruz
        // Ancak daha temiz olması için yeni bir 'get-user-by-email' rotası da yapabilirsin.
        // Şimdilik addTask'taki gibi bir mantıkla çalıştıralım:
        
        const res = await fetch(`/get-student-id?email=${email}`, { headers: getAuthHeaders() });
        const data = await res.json();

        if (res.ok && data.studentId) {
            // ID'yi bulduk, şimdi grafiği çizdirelim
            localStorage.setItem("lastViewedStudentId", data.studentId);
            loadStatistics(data.studentId);
        } else {
            alert("Öğrenci bulunamadı.");
        }
    } catch (error) {
        console.error("E-posta ile istatistik getirme hatası:", error);
        alert("Bir hata oluştu.");
    }
}
async function sendCode() {
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role') || 'student';

    if (!name || !email || !password) {
        alert("Lütfen tüm alanları doldurun.");
        return;
    }

    try {
        const res = await fetch("/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password, role })
        });

        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            document.getElementById("registration-form").style.display = "none";
            document.getElementById("verification-section").style.display = "block";
        } else {
            alert("Hata: " + data.message);
        }
    } catch (error) {
        alert("Sunucuya bağlanılamadı.");
    }
}
async function verifyAndRegister() {
    const email = document.getElementById("email").value;
    const code = document.getElementById("vCode").value;

    if (!code) {
        alert("Lütfen kodu girin.");
        return;
    }

    try {
        const res = await fetch("/verify-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code })
        });

        const data = await res.json();
        if (res.ok) {
            alert("Kayıt tamamlandı! Giriş yapabilirsiniz.");
            window.location.href = "index.html";
        } else {
            alert("Hata: " + data.message);
        }
    } catch (error) {
        alert("Doğrulama sırasında bir hata oluştu.");
    }
}