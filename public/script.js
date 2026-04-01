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
        const completedCountEl = document.getElementById("completed-count"); // HTML'deki o 0 yazan yer
        
        if (taskList) taskList.innerHTML = "";
        if (completedTaskList) completedTaskList.innerHTML = "";
        
        let completedCounter = 0; // Sayacı burada başlatıyoruz

        tasks.forEach(task => {
            const li = document.createElement("li");
            
            // Rozet kontrolü ve stil
            const isBadgeTask = task.badge_reward && task.badge_reward !== "";
            const badgeStyle = isBadgeTask ? "border: 2px solid #f6ad55; background: #fffcf0;" : "border: 1px solid #edf2f7; background: white;";
            
            let baseStyle = `padding: 15px; margin-bottom: 12px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; transition: 0.3s; ${badgeStyle}`;

            // TAMAMLANAN VEYA ONAY BEKLEYEN GÖREVLER İÇİN
            if (task.status === 'Tamamlandı' || task.status === 'Onay Bekliyor') {
                baseStyle += " opacity: 0.6; pointer-events: none; filter: grayscale(50%);";
                
                // Sadece 'Tamamlandı' olanları saymak istersen bu if kalsın:
                if (task.status === 'Tamamlandı') {
                    completedCounter++; 
                }
            }

            li.style = baseStyle;

            li.innerHTML = `
                           <div style="flex: 1;">
                           <strong style="color: #2d3748; display: block;">${task.title}</strong>
                           <small style="color: #718096;">${task.reward_points} GP ${isBadgeTask ? `+ 🏆 ${task.badge_reward}` : ""}</small>
                           </div>
                           <div style="display: flex; align-items: center; gap: 10px;">
                           <select onchange="updateTaskStatus(${task.id}, this.value)" class="status-select" 
                           style="padding: 5px; border-radius: 8px; border: 1px solid #cbd5e0; font-size: 0.8rem; cursor: pointer;
                           ${task.status === 'Tamamlandı' ? 'background: #f0fff4; color: #2f855a;' : ''}">
                           <option value="Baslamadi" ${task.status === 'Baslamadi' ? 'selected' : ''}>🔴 Başlamadı</option>
                           <option value="Baslandi" ${task.status === 'Baslandi' ? 'selected' : ''}>🟡 Başlandı</option>
                           <option value="DevamEdiyor" ${task.status === 'DevamEdiyor' ? 'selected' : ''}>🔵 Devam Ediyor</option>
                           <option value="Tamamlandı" ${task.status === 'Tamamlandı' ? 'selected' : ''}>🟢 Tamamlandı</option>
                           </select>
                           </div>
                           `;

            // Listelere dağıtma
            if (task.status === 'Tamamlandı') {
                if (completedTaskList) completedTaskList.appendChild(li);
            } else {
                if (taskList) taskList.appendChild(li);
            }
        });

        // EKRANDAKİ SAYIYI GÜNCELLEME (İstediğin kısım)
        if (completedCountEl) {
            completedCountEl.innerText = completedCounter;
        }

    } catch (error) {
        console.error("Görevler yüklenirken hata:", error);
    }
}

async function updateTaskStatus(taskId, newStatus) {
    try {
        const response = await fetch(`/update-task-status/${taskId}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            // Eğer 'Tamamlandı' seçildiyse bir onay mesajı verebiliriz
            if (newStatus === 'Tamamlandı') {
                alert("🎉 Harika! Görev tamamlandı olarak işaretlendi.");
            }
            loadMyTasks(); // Listeyi yenile
        } else {
            alert("Durum güncellenirken bir hata oluştu.");
        }
    } catch (error) {
        console.error("Hata:", error);
    }
}

async function loadStudentPoints() {
    try {
        const response = await fetch(`/user-points/${userId}`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        const data = await response.json();

        // HTML'deki elementleri bulalım
        const xpDisplay = document.getElementById("total-xp-display");
        const gpDisplay = document.getElementById("total-points");
        const rankDisplay = document.getElementById("user-rank");
        const levelDisplay = document.getElementById("user-level");

        const totalXP = data.total_points || 0;
        const currentGP = data.current_balance || 0;

        // Değerleri ekrana yazalım
        if (xpDisplay) xpDisplay.innerText = totalXP;
        if (gpDisplay) gpDisplay.innerText = currentGP;

        // Rütbe ve Seviye Hesaplama
        if (rankDisplay) {
            let rank = "⚪ Çaylak";
            let level = 1;

            if (totalXP >= 6000) {
                rank = "👑 Efsane";
                level = 5;
            } else if (totalXP >= 3001) {
                rank = "🟢 Kahraman";
                level = 4;
            } else if (totalXP >= 1501) {
                rank = "🟣 Usta";
                level = 3;
            } else if (totalXP >= 501) {
                rank = "🔵 Asistan";
                level = 2;
            }

            rankDisplay.innerText = rank;
            if (levelDisplay) levelDisplay.innerText = level;
        }

    } catch (error) {
        console.error("Puanlar yüklenirken hata:", error);
    }
}
async function loadMyAssignedTasks() {
    const userId = localStorage.getItem("userId");
    const token = localStorage.getItem("token");
    if (!userId || !token) return;

    try {
        const res = await fetch(`/assigned-tasks/${userId}`, { 
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            }
        });
        const tasks = await res.json();

        // Elementleri Seç
        const taskList = document.getElementById("taskList");
        const inProgressList = document.getElementById("inProgressList");
        const completedList = document.getElementById("completedList");

        // Temizle
        if (taskList) taskList.innerHTML = "";
        if (inProgressList) inProgressList.innerHTML = "";
        if (completedList) completedList.innerHTML = "";

        tasks.forEach(task => {
            const li = document.createElement("li");
            li.className = "task-card";
            
            // Teslim tarihi formatlama
            const dateStr = task.due_date ? new Date(task.due_date).toLocaleDateString('tr-TR') : "Tarih yok";

            li.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div>
                        <strong style="display:block; color:#2d3748;">${task.title}</strong>
                        <small style="color:#718096;">Öğrenci: ${task.student_name || 'Atanmamış'}</small><br>
                        <small style="color:#718096;">📅 ${dateStr}</small>
                    </div>
                    <button onclick="deleteTask(${task.id})" style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold;">✕</button>
                </div>
            `;

            // STATÜ KONTROLÜ (Garantili Yöntem)
            const s = (task.status || "").toLowerCase().trim();

            if (s === "tamamlandi" || s === "tamamlandı") {
                if (completedList) completedList.appendChild(li);
            } 
            else if (s === "baslandi" || s === "başlandı" || s === "devam ediyor" || s === "devamediyor") {
                if (inProgressList) inProgressList.appendChild(li);
            } 
            else {
                // Başlamadı veya başka ne yazarsa yazsın buraya düşer, böylece görev kaybolmaz
                if (taskList) taskList.appendChild(li);
            }
        });
    } catch (err) {
        console.error("Veli görev yükleme hatası:", err);
    }
}

// Yardımcı fonksiyon: Listeye eleman eklemek için
function renderTaskItem(task, listElement) {
    if (!listElement) return;
    const li = document.createElement("li");
    li.className = "task-item";
    li.innerHTML = `
        <div style="flex: 1;">
            <div style="font-weight: 600; color: #1e293b;">${task.student_name} - ${task.title}</div>
            <div style="font-size: 0.8rem; color: #64748b;">Teslim: ${fixDate(task.due_date)} | ${task.gp_reward} GP</div>
        </div>
        <button onclick="confirmDeleteTask(${task.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;">🗑️</button>
    `;
    listElement.appendChild(li);
}

async function addTask() {
    const title = document.getElementById("taskTitle").value;
    const description = document.getElementById("taskDescription").value;
    const assignedToEmail = document.getElementById("assignedToEmail").value;
    const dueDate = document.getElementById("dueDate").value;
    const dueTime = document.getElementById("dueTime").value;
    const badgeReward = document.getElementById("taskBadge").value;
    const rewardPoints = document.getElementById("taskPoints").value; 

    if (!title || !assignedToEmail) {
        alert("Lütfen başlık ve öğrenci e-postasını doldurun!");
        return;
    }

    try {
        const res = await fetch("/add-task", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                title,
                description,
                assignedToEmail: assignedToEmail.trim(),
                dueDate,
                dueTime,
                badge_reward: badgeReward,
                reward_points: parseInt(rewardPoints) || 10
            })
        });

        const result = await res.json();
        if (res.ok) {
            alert("🚀 Görev başarıyla gönderildi!");
            location.reload(); // Sayfayı yenile ki liste güncellensin
        } else {
            alert("❌ Hata: " + result.message);
        }
    } catch (error) {
        console.error("İstek hatası:", error);
        alert("Sunucuya bağlanılamadı.");
    }
}
async function deleteTask(taskId) {
    // Önce kullanıcıdan onay al
    if (!confirm("Bu görevi silmek istediğinize emin misiniz?")) return;

    try {
        // Silmeden önce görevin durumunu kontrol et (Backend'den de kontrol edilebilir ama buradan hızlı engel)
        // Eğer silinmeye çalışılan görev tamamlanmışsa işlemi durdur.
        
        const response = await fetch(`/tasks/${taskId}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });

        if (response.ok) {
            alert("Görev başarıyla silindi.");
            loadMyAssignedTasks(); // Listeyi yenile
        } else {
            const error = await response.json();
            alert(error.message || "Tamamlanmış görevler silinemez!");
        }
    } catch (err) {
        console.error("Silme hatası:", err);
    }
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
// script.js
async function loadPendingPurchases() {
    try {
        const response = await fetch("/pending-purchases", {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        const data = await response.json();
        
        const badge = document.getElementById("market-badge");
        const listContainer = document.getElementById("pending-purchases-list");

        // Sayıyı güncelle
        if (badge) {
            if (data.length > 0) {
                badge.innerText = data.length;
                badge.style.display = "flex"; // Kırmızı yuvarlağı göster
            } else {
                badge.style.display = "none"; // Onay yoksa gizle
            }
        }

        // Listeyi doldur (Eğer modal içindeyse)
        if (listContainer) {
            if (data.length === 0) {
                listContainer.innerHTML = "<p style='text-align:center; padding:20px; color:#999;'>Bekleyen onay yok.</p>";
            } else {
                listContainer.innerHTML = data.map(item => `
                    <div class="task-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:15px; background:#fff; border-radius:12px; border:1px solid #eee;">
                        <div>
                            <strong>${item.reward_name}</strong>
                            <div style="font-size:0.8rem; color:#666;">Maliyet: ${item.cost} GP</div>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button onclick="approvePurchase(${item.id}, 'Onaylandı')" style="background:#48bb78; color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer;">✅ Onayla</button>
                            <button onclick="approvePurchase(${item.id}, 'Reddedildi')" style="background:#f56565; color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer;">❌ Reddet</button>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error("Yükleme hatası:", error);
    }
}
async function approvePurchase(purchaseId, status) {
    let reason = ""; // Varsayılan boş açıklama

    // 1. Reddetme durumunda neden sor
    if (status === "Reddedildi") {
        const userInput = prompt("Reddetme nedenini yazar mısınız? (İsteğe bağlı)");
        
        // Eğer kullanıcı 'İptal'e basarsa işlemi durdur
        if (userInput === null) return; 
        reason = userInput; 
    } else {
        // Onaylama durumunda teyit al (Yanlışlıkla basılmasını önler)
        if (!confirm("Bu ödül alımını onaylıyor musunuz?")) return;
    }

    try {
        const res = await fetch("/update-purchase-status", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({ 
                purchaseId: purchaseId, 
                status: status, 
                reason: reason 
            })
        });
        
        if (res.ok) {
            // Başarı mesajı
            alert(status === "Reddedildi" ? "❌ Ödül reddedildi." : "✅ Ödül başarıyla onaylandı!");
            
            // 2. KRİTİK: Listeyi ve Bildirim Rozetini (Badge) anında yenile
            if (typeof loadPendingPurchases === "function") {
                await loadPendingPurchases(); 
            }

            // Eğer öğrenci puanlarının da yenilenmesi gerekiyorsa (veli ekranında öğrenci seçiliyse)
            if (typeof loadStudentPoints === "function") {
                loadStudentPoints();
            }

            // 3. EĞER LİSTE BOŞALDIYSA MODALI KAPAT (Opsiyonel konfor ayarı)
            const listContainer = document.getElementById("pending-purchases-list");
            if (listContainer && listContainer.children.length === 0) {
                // Eğer istersen onay listesi bittiğinde modalı otomatik kapatabilirsin:
                // closeModal('market-modal');
            }

        } else {
            const err = await res.json();
            alert("İşlem başarısız: " + (err.message || "Bilinmeyen hata"));
        }
    } catch (error) {
        console.error("Onaylama/Reddetme Hatası:", error);
        alert("Bağlantı hatası: Sunucuya ulaşılamadı.");
    }
}
async function loadRejectedPurchases() {
    const list = document.getElementById("rejected-list"); // HTML'de bu ID var mı kontrol et!
    if (!list) return; // Eğer ID yoksa fonksiyonu durdur, hata verme.

    try {
        const response = await fetch(`/rejected-purchases/${userId}`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error("Sunucu hatası");
        
        const data = await response.json();
        list.innerHTML = data.map(item => `
            <div class="rejected-item">
                <span>${item.reward_name} - ${item.cost} GP</span>
                <p>Neden: ${item.rejection_reason || 'Belirtilmedi'}</p>
            </div>
        `).join("");
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
    const historyContainer = document.getElementById("history-container");
    
    if (!email) {
        return alert("Lütfen bir e-posta adresi girin.");
    }

    try {
        // 1. ADIM: E-posta ile öğrencinin ID'sini bul
        const userRes = await fetch(`/get-user-by-email?email=${email}`, { 
            headers: getAuthHeaders() 
        });

        // Eğer sunucu 404 veya 500 dönerse hatayı yakala
        if (!userRes.ok) {
            const errorData = await userRes.json();
            throw new Error(errorData.message || "Öğrenci bulunamadı.");
        }

        const user = await userRes.json();
        const studentId = user.id;

        // 2. ADIM: Bu ID ile istatistikleri ve görev geçmişini getir
        const statsRes = await fetch(`/user-stats/${studentId}`, { 
            headers: getAuthHeaders() 
        });

        if (!statsRes.ok) {
            throw new Error("İstatistik verileri alınamadı.");
        }

        const data = await statsRes.json();

        // 3. ADIM: Grafiği çiz (data.labels ve data.values kullanarak)
        renderChart(data.labels, data.values);

        // 4. ADIM: Görev geçmişini (details) listele
        if (historyContainer) {
            historyContainer.innerHTML = ""; // Önce içini temizle
            
            if (data.details && data.details.length > 0) {
                data.details.forEach(task => {
                    // Tarihi formatla (Örn: 25 Mart, 14:30)
                    const date = new Date(task.updated_at).toLocaleString('tr-TR', {
                        day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit'
                    });

                    const item = document.createElement("div");
                    item.style = "background: #f8fafc; padding: 10px 15px; border-radius: 10px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #2ecc71; box-shadow: 0 2px 4px rgba(0,0,0,0.02);";
                    item.innerHTML = `
                        <div>
                            <strong style="display: block; color: #2d3748; font-size: 14px;">${task.title}</strong>
                            <span style="font-size: 11px; color: #718096;">${date} tarihinde tamamlandı</span>
                        </div>
                        <div style="background: #eefdf3; color: #166534; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold;">
                            +${task.points || 0} Puan
                        </div>
                    `;
                    historyContainer.appendChild(item);
                });
            } else {
                historyContainer.innerHTML = `<p style="text-align:center; color:#999; font-size:13px; margin-top:10px;">Henüz tamamlanan görev bulunamadı.</p>`;
            }
        }

    } catch (error) {
        console.error("İstatistik Yükleme Hatası:", error);
        alert("Hata: " + error.message);
    }
}
async function sendCode() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role') || 'student';

    if (!email || !password) {
        alert("Lütfen mail ve şifre alanlarını doldurun.");
        return;
    }

    try {
        const res = await fetch("/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, role }) // name çıkarıldı
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
function toggleFocusMode(isFocus) {
    // Sayfadaki ana bölümleri seçelim (senin ID'lerine göre düzenleyebilirsin)
    const header = document.querySelector('header') || document.querySelector('.header');
    const mainContent = document.querySelectorAll('.card, .column, .form-section, h2, p');
    const graphSection = document.getElementById('graph-section');
    const chartContainer = document.getElementById('chart-container');
    const openBtn = document.getElementById('open-focus-btn');
    const closeBtn = document.getElementById('close-focus-btn');

    if (isFocus) {
        // ODAKLANMA MODU AÇIK
        mainContent.forEach(el => {
            if (el !== graphSection) el.style.display = 'none';
        });
        if(header) header.style.display = 'none';

        graphSection.style.position = 'fixed';
        graphSection.style.top = '0';
        graphSection.style.left = '0';
        graphSection.style.width = '100vw';
        graphSection.style.height = '100vh';
        graphSection.style.zIndex = '9999';
        graphSection.style.borderRadius = '0';
        
        chartContainer.style.maxHeight = '80vh';
        document.getElementById('myChart').style.maxHeight = '80vh';

        openBtn.style.display = 'none';
        closeBtn.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Kaydırmayı engelle
    } else {
        // NORMAL MODA DÖN
        location.reload(); // En temiz yöntem sayfayı yenilemektir ama istersen manuel de açabilirsin:
        /*
        mainContent.forEach(el => el.style.display = '');
        if(header) header.style.display = '';
        graphSection.style = ''; 
        openBtn.style.display = 'block';
        closeBtn.style.display = 'none';
        document.body.style.overflow = 'auto';
        */
    }
}
let myChartInstance = null; // Eski grafiği silip yenisini yapmak için

function renderChart(labels, values) {
    const ctx = document.getElementById('myChart');
    if (!ctx) return; // Canvas yoksa çık

    // Eğer zaten bir grafik çizilmişse, onu yok et (çakışma olmaması için)
    if (myChartInstance) {
        myChartInstance.destroy();
    }

    myChartInstance = new Chart(ctx, {
        type: 'line', // Çizgi grafiği
        data: {
            labels: labels, // Günler (Örn: 25 Mar, 26 Mar)
            datasets: [{
                label: 'Tamamlanan Görevler',
                data: values, // Görev sayıları
                borderColor: '#4facfe',
                backgroundColor: 'rgba(79, 172, 254, 0.2)',
                borderWidth: 3,
                tension: 0.4, // Çizgiyi yumuşatır
                fill: true,
                pointBackgroundColor: '#4facfe',
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1 // Sadece tam sayıları göster
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}
// server.js içine eklenecek yardımcı fonksiyon
async function checkAndGrantBadges(userId, userEmail) {
    try {
        // Tamamlanan toplam görev sayısını say
        const countRes = await db.query(
            "SELECT COUNT(*) FROM tasks WHERE assigned_to = $1 AND status = 'Tamamlandı'",
            [userEmail]
        );
        const totalDone = parseInt(countRes.rows[0].count);

        // Rozet kriterleri
        const milestones = [
            { name: "İlk Adım", icon: "🌱", requirement: 1 },
            { name: "Görev Ustası", icon: "⚔️", requirement: 10 },
            { name: "Yarım Dalya", icon: "🔥", requirement: 50 },
            { name: "Efsane", icon: "👑", requirement: 100 }
        ];

        for (const m of milestones) {
            if (totalDone >= m.requirement) {
                // Eğer kullanıcıda bu rozet yoksa ekle (UNIQUE kısıtlaması sayesinde hata vermez)
                await db.query(
                    "INSERT INTO user_badges (user_id, badge_name, badge_icon) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
                    [userId, m.name, m.icon]
                );
            }
        }
    } catch (err) {
        console.error("Rozet kontrol hatası:", err);
    }
}

// BU FONKSİYONU GÖREV TAMAMLANDIĞINDA ÇAĞIR:
// app.put("/update-task-status/:id", ...) içinde status === 'Tamamlandı' olduğu satıra:
// await checkAndGrantBadges(userId, userEmail);
async function loadMyBadges() {
    const userId = localStorage.getItem("userId");
    const container = document.getElementById("badge-container");
    if (!container || !userId) return;

    try {
        const res = await fetch(`/my-badges/${userId}`, { headers: getAuthHeaders() });
        const badges = await res.json();

        if (!badges || badges.length === 0) {
            container.innerHTML = '<p style="color: #a0aec0; font-size: 0.8rem; width:100%; text-align:center;">Henüz rozet kazanılmadı.</p>';
            return;
        }

        const badgeIcons = {
            "Kitap Kurdu": "📖",
            "Temizlik Ustası": "🧹",
            "Sabah Yıldızı": "☀️",
            "Matematik Dehası": "🔢",
            "Süper Evlat": "⭐"
        };

        container.innerHTML = badges.map(badge => {
            const icon = badgeIcons[badge.badge_reward] || "🏅";
            // Eğer sayı 1'den büyükse yanına x2, x3 gibi yazdır
            const countBadge = badge.count > 1 ? `<span style="position:absolute; top:-5px; right:-5px; background:#ff4d4d; color:white; border-radius:50%; padding:2px 6px; font-size:10px; font-weight:bold; border:2px solid white;">x${badge.count}</span>` : "";

            return `
                <div class="badge-item" style="position:relative; display: flex; flex-direction: column; align-items: center;">
                    ${countBadge}
                    <span style="font-size: 2rem;">${icon}</span>
                    <span style="font-size: 0.7rem; font-weight: bold; color: #2d3748; margin-top:5px; text-align:center;">${badge.badge_reward}</span>
                </div>
            `;
        }).join("");

    } catch (error) {
        console.error("Rozet yükleme hatası:", error);
    }
}
// Ödül Listesi (Senin istediğin o özel 4 ödül)
async function buyReward(name, cost) {
    if (!confirm(`${name} ödülünü ${cost} GP karşılığında satın almak istiyor musun?`)) return;

    try {
        const response = await fetch("/buy-reward", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ rewardName: name, cost: cost })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`🎉 Tebrikler! "${name}" ödülünü aldın. Veli onayından sonra tadını çıkarabilirsin!`);
            loadStudentPoints(); // Puanı güncelle
            loadMarketItems();  // Market görünümünü güncelle
        } else {
            alert("Hata: " + data.message);
        }
    } catch (error) {
        console.error("Satın alma hatası:", error);
    }
}
// Sepet Arayüzünü Güncelleme
function updateCartUI() {
    const cartCount = document.getElementById("cart-count");
    
    // Toplam parça sayısını hesapla (Örn: 2 Elma + 1 Armut = 3)
    const totalQuantity = cart.reduce((total, item) => total + item.quantity, 0);
    
    if (cartCount) cartCount.innerText = totalQuantity;

    // Toplam tutar hesaplaması (Fiyat * Miktar)
    const totalCost = cart.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
    const totalDisplay = document.getElementById("cart-total-amount");
    if (totalDisplay) totalDisplay.innerText = `${totalCost} GP`;
}

// Sepeti Açıp İçindekileri Gösterme
function showCart() {
    const cartItemsList = document.getElementById("cart-items-list");
    if (!cartItemsList) return;

    if (cart.length === 0) {
        cartItemsList.innerHTML = "<p style='text-align:center; color:#a0aec0; padding:30px;'>Sepetiniz şu an boş.</p>";
    } else {
        cartItemsList.innerHTML = cart.map((item, index) => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px; border-bottom: 1px solid #f1f5f9;">
                <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                    <span style="font-size: 1.8rem;">${item.icon}</span>
                    <div>
                        <div style="font-weight: 600; color: #1e293b; font-size: 1rem;">${item.name}</div>
                        <div style="font-size: 0.85rem; color: #4facfe; font-weight: bold;">${item.cost * item.quantity} GP</div>
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; background: #f1f5f9; border-radius: 10px; padding: 4px; gap: 12px;">
                    <button onclick="changeQuantity(${index}, -1)" 
                        style="width: 32px; height: 32px; border-radius: 8px; border: none; 
                               background: ${item.quantity === 1 ? '#fee2e2' : '#ffffff'}; 
                               cursor: pointer; font-weight: bold; 
                               color: ${item.quantity === 1 ? '#ef4444' : '#475569'}; 
                               box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                               transition: 0.2s; display: flex; align-items: center; justify-content: center;">
                        ${item.quantity === 1 ? '🗑️' : '-'}
                    </button>
                    
                    <span style="font-weight: 800; min-width: 20px; text-align: center; color: #1e293b;">${item.quantity}</span>
                    
                    <button onclick="changeQuantity(${index}, 1)" 
                        style="width: 32px; height: 32px; border-radius: 8px; border: none; 
                               background: #ffffff; cursor: pointer; font-weight: bold; 
                               color: #475569; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                               transition: 0.2s; display: flex; align-items: center; justify-content: center;">
                        +
                    </button>
                </div>
            </div>
        `).join("");
    }

    document.getElementById("cart-modal").style.display = "flex";
}

function closeCart() {
    document.getElementById("cart-modal").style.display = "none";
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
    showCart(); // Listeyi yenilemek için tekrar çağır
}


// -------------------- GÜNCEL MARKET & SEPET SİSTEMİ --------------------
let cart = []; // Sepet dizisi

// Ürün Listesi
const marketRewards = [
    { name: "+1 Saat Oyun", cost: 100, icon: "🎮" },
    { name: "Yemek Seçimi", cost: 250, icon: "🍕" },
    { name: "Dondurma", cost: 150, icon: "🍦" },
    { name: "Film Gecesi", cost: 500, icon: "🍿" }
];

// Marketi Yükle
function loadMarketItems() {
    const grid = document.getElementById("market-items-grid");
    if (!grid) return;

    grid.innerHTML = marketRewards.map(item => `
        <div class="market-card">
            <div style="font-size: 2.5rem; margin-bottom: 10px;">${item.icon}</div>
            <h4 style="margin: 5px 0; font-size: 1rem; color: #2d3748;">${item.name}</h4>
            <div style="color: #4facfe; font-weight: bold; margin-bottom: 10px;">${item.cost} GP</div>
            <button onclick="addToCart('${item.name}', ${item.cost}, '${item.icon}')" 
                style="width: 100%; padding: 10px; border-radius: 10px; border: none; background: #4facfe; color: white; cursor: pointer; font-weight: bold;">
                ➕ Sepete Ekle
            </button>
        </div>
    `).join("");
    updateCartUI();
}
function addToCart(rewardName, cost, icon) {
    // Sepette bu ürün var mı bak
    const existingItem = cart.find(item => item.name === rewardName);

    if (existingItem) {
        // Varsa miktarını 1 artır
        existingItem.quantity += 1;
    } else {
        // Yoksa yeni bir obje olarak ekle ve miktarını 1 yap
        cart.push({ 
            name: rewardName, 
            cost: cost, 
            icon: icon, 
            quantity: 1 
        });
    }
    
    // Arayüzü ve sayıları güncelle
    updateCartUI();
}
// Sepet Arayüzünü Güncelle
function updateCartUI() {
    const cartCount = document.getElementById("cart-count"); // Sepet ikonundaki sayı
    const totalDisplay = document.getElementById("cart-total-amount"); // Toplam GP

    // Sepetteki tüm ürünlerin quantity (miktar) değerlerini topla
    // Örn: 2 Elma + 3 Armut = 5 Ürün
    const totalQuantity = cart.reduce((toplam, urun) => toplam + urun.quantity, 0);
    
    if (cartCount) {
        cartCount.innerText = totalQuantity;
    }

    // Toplam tutarı da (Fiyat * Miktar) şeklinde hesapla
    const totalCost = cart.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
    
    if (totalDisplay) {
        totalDisplay.innerText = `${totalCost} GP`;
    }
}
function closeCart() {
    document.getElementById("cart-modal").style.display = "none";
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
    showCart(); // Listeyi anlık güncelle
}
async function rejectPurchase(id) {
    const reason = prompt("Reddetme sebebi (isteğe bağlı):");
    try {
        const res = await fetch(`/reject-purchase/${id}`, { 
            method: "POST", 
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}` 
            },
            body: JSON.stringify({ reason })
        });
        if (res.ok) {
            alert("İşlem reddedildi.");
            loadPendingPurchases(); // Listeyi ve Badge sayısını yenile
        }
    } catch (err) { console.error(err); }
}
function changeQuantity(index, delta) {
    if (!cart[index]) return;

    // Ürün 1 adetse ve azaltılıyorsa onay modalını aç
    if (cart[index].quantity === 1 && delta === -1) {
        const modal = document.getElementById("confirm-modal");
        const yesBtn = document.getElementById("confirm-yes-btn");
        const cancelBtn = document.getElementById("confirm-cancel-btn");
        const confirmText = document.getElementById("confirm-text");

        confirmText.innerText = `${cart[index].name} ürününü sepetten tamamen silmek istiyor musunuz?`;
        modal.style.display = "flex";

        yesBtn.onclick = function() {
            cart.splice(index, 1);
            modal.style.display = "none";
            updateCartUI();
            showCart();
        };

        cancelBtn.onclick = function() {
            modal.style.display = "none";
        };

    } else {
        // Normal miktar artış/azalışı
        cart[index].quantity += delta;
        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }
        updateCartUI();
        showCart();
    }
}
// script.js içindeki checkout fonksiyonunu bununla güncelle:
// script.js içindeki checkout fonksiyonunu bununla değiştir:
async function checkout() {
    if (!cart || cart.length === 0) {
        alert("Sepetiniz boş!");
        return;
    }

    const userId = localStorage.getItem("userId");
    const totalCost = cart.reduce((sum, item) => sum + (item.cost * (item.quantity || 1)), 0);

    const itemsToPost = cart.map(item => ({
        reward_name: item.name, 
        cost: item.cost
    }));

    try {
        const res = await fetch("/checkout", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ userId, items: itemsToPost, totalCost })
        });

        const data = await res.json();

        if (res.ok) {
            alert("✅ " + data.message);
            cart = []; 
            updateCartUI();
            closeCart();
            
            // Puanı ekranda hemen güncellemek için:
            if (typeof loadStudentPoints === "function") {
                loadStudentPoints(); 
            } else {
                window.location.reload(); // Fonksiyon yoksa sayfayı yenile
            }
        } else {
            alert("❌ Hata: " + (data.message || "Bir sorun oluştu"));
        }
    } catch (error) {
        console.error("İstek hatası:", error);
        alert("Sunucuya bağlanılamadı.");
    }
}
document.getElementById('dueTime')?.addEventListener('change', function() {
    const el = this;
    // Küçük bir gecikme ile odağı kaydırarak panelin kapanmasını zorla
    setTimeout(() => {
        el.blur();
    }, 50);
});
let taskToDelete = null;

// Silme onay penceresini açar
function askDeleteTask(taskId) {
    taskToDelete = taskId;
    const modal = document.getElementById('delete-confirm-modal');
    modal.style.display = 'flex';
    
    // Onay butonuna tıklama olayını bağla
    document.getElementById('confirm-delete-btn').onclick = async function() {
        await executeDeleteTask();
    };
}
async function executeDeleteTask() {
    if (!taskToDelete) return;
    
    try {
        const response = await fetch(`/delete-task/${taskToDelete}`, {
            method: "DELETE",
            headers: getAuthHeaders() // Token gönderimi için şart
        });

        if (response.ok) {
            closeModal('delete-confirm-modal'); 
            loadMyAssignedTasks(); // Listeyi güncelle
        } else {
            const err = await response.json();
            alert("Hata: " + err.message);
        }
    } catch (err) {
        console.error("Bağlantı hatası:", err);
    }
}
async function checkOverdueTasks() {
    const userId = localStorage.getItem("userId");
    const alertBox = document.getElementById("overdue-alert-container");
    if (!userId || !alertBox) return;

    try {
        const res = await fetch(`/overdue-tasks/${userId}`, { headers: getAuthHeaders() });
        const data = await res.json();

        if (data.length > 0) {
            alertBox.style.display = "block";
            alertBox.innerHTML = `
                <div style="background: #fff5f5; border: 2px solid #feb2b2; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                    <h4 style="margin:0 0 10px 0; color:#c53030; font-size: 1rem;">⚠️ Süresi Dolan Görevler</h4>
                    ${data.map(t => `
                        <div style="background:white; margin-bottom:5px; padding:10px; border-radius:8px; font-size:13px; border-left:4px solid #f56565; display:flex; justify-content:space-between; align-items:center;">
                            <span><strong>${t.student_name}:</strong> ${t.title}</span>
                            <span style="color:#e53e3e; font-weight:bold;">${fixDate(t.due_date)}</span>
                        </div>
                    `).join('')}
                </div>`;
        } else {
            alertBox.style.display = "none";
        }
    } catch (err) { console.error(err); }
}