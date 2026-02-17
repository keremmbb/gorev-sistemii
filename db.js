const { Pool } = require("pg");
require("dotenv").config();

const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

db.on("connect", () => {
  console.log("VERİTABANI BAĞLANDI ✅");
});

db.on("error", (err) => {
  console.error("DB HATASI ❌", err);
}); 

module.exports = db;
