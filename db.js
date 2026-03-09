const { Pool } = require("pg");
require("dotenv").config();

// Render'da DATABASE_URL (URL formunda), yerelde parçalı bilgiler kullanılır.
const dbConfig = process.env.DATABASE_URL 
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Render PostgreSQL için zorunludur
      connectionTimeoutMillis: 15000,     // 15 saniye bekler, sonra hata verir
      max: 5                              // Aynı anda çok fazla bağlantı açılmasını engeller
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

db.on("connect", () => console.log("VERİTABANI BAĞLANDI ✅"));
db.on("error", (err) => console.error("DB HATASI ❌", err));

module.exports = db;