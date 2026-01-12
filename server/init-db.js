import sqlite3 from "sqlite3";
import { DB_PATH } from "./utils/dbPath.js";

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) throw err;
  console.log("✅ DB opened successfully");
});

db.run(
  `CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_url TEXT,
    heading TEXT,
    content TEXT,
    embedding TEXT
  );`,
  (err) => {
    if (err) throw err;
    console.log("✅ Table 'chunks' ensured");
    db.close();
  }
);
