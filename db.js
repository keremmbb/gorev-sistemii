const { Pool } = require("pg");
require("dotenv").config();

// Render'da DATABASE_URL kullanılır, yerelde ise senin .env dosmandaki tekil bilgiler.
const isProduction = process.env.DATABASE_URL;

const db = new Pool({
  connectionString: isProduction ? process.env.DATABASE_URL : undefined,
  user: isProduction ? undefined : process.env.DB_USER,
  host: isProduction ? undefined : process.env.DB_HOST,
  database: isProduction ? undefined : process.env.DB_NAME,
  password: isProduction ? undefined : process.env.DB_PASSWORD,
  port: isProduction ? undefined : process.env.DB_PORT,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

db.on("connect", () => {
  console.log("VERİTABANI BAĞLANDI ✅");
});

db.on("error", (err) => {
  console.error("DB HATASI ❌", err);
});

module.exports = db;