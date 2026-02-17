const { spawn } = require("child_process");
const ngrok = require("ngrok");
require("dotenv").config();

// 1️⃣ Backend'i başlat
console.log("🟢 Backend başlatılıyor...");
const backend = spawn("node", ["server.js"], { stdio: "inherit" });

(async () => {
  const port = process.env.PORT || 3000;
  const authtoken = process.env.NGROK_AUTHTOKEN || "senin_authtoken";

  try {
    // Ngrok authtoken ekle
    await ngrok.authtoken(authtoken);

    // Tünel oluştur (name artık benzersiz, çakışma yok)
    const url = await ngrok.connect({
      addr: port,
      proto: "http",
      region: "eu",
      name: "sms-login-" + Date.now() // her seferinde benzersiz isim
    });

    console.log("\n🚀 Ngrok linki hazır:", url);
    console.log("Bu linki veliler ve öğrenciler kullanabilir.");
    console.log("Terminali kapatma, link açık kalır.");
    console.log("Web arayüzü:", "http://127.0.0.1:4040\n");

    // 🟢 FRONTEND_URL'i backend için env olarak ayarla
    process.env.FRONTEND_URL = url;
    console.log("FRONTEND_URL backend için güncellendi:", process.env.FRONTEND_URL);

  } catch (err) {
    console.error("Ngrok başlatılamadı:", err);
  }
})();
