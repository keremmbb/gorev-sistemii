// ngrok-start.js
const ngrok = require('ngrok');

(async function() {
    try {
        // Buraya server.js'in çalıştığı portu yaz
        const port = process.env.PORT || 3000; // server.js portu
        const url = await ngrok.connect(port);
        console.log("🚀 Ngrok çalışıyor!");
        console.log("Public URL:", url);
        console.log("Bu linki veliler ve öğrenciler kullanabilir.");
    } catch (err) {
        console.error("Ngrok başlatılamadı:", err);
    }
})();