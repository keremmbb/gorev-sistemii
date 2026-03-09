const { Pool } = require("pg");
require("dotenv").config();

// Render'da DATABASE_URL kullanılır, yerelde ise parçalı bilgiler.
const dbConfig = process.env.DATABASE_URL 
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Render PostgreSQL için zorunludur
      connectionTimeoutMillis: 30000,    // 30 saniye bekler (Timeout hatasını önlemek için)
      idleTimeoutMillis: 30000,          // Boşta kalan bağlantıları 30 saniyede kapatır
      max: 2                             // Ücretsiz planda bağlantı darboğazını önlemek için düşük tuttuk
    }
  : {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
      ssl: false
    };

const db = new Pool(dbConfig);

db.on("connect", () => {
  console.log("VERİTABANI BAĞLANDI ✅");
});

db.on("error", (err) => {
  console.error("DB HATASI ❌", err);
});

module.exports = db;