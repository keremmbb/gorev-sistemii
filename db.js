const { Pool } = require("pg");
require("dotenv").config();

const dbConfig = process.env.DATABASE_URL 
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      max: 2,
      options: "-c timezone=Europe/Istanbul" // SAAT DİLİMİ ZORLAMASI
    }
  : {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
      ssl: false,
      options: "-c timezone=Europe/Istanbul" // SAAT DİLİMİ ZORLAMASI
    };

const db = new Pool(dbConfig);

db.on("connect", () => {
  console.log("VERİTABANI BAĞLANDI ✅ (Saat Dilimi: İstanbul)");
});

db.on("error", (err) => {
  console.error("DB HATASI ❌", err);
});

module.exports = db;