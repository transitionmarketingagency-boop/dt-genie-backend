import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";

// Step 1: Restore correct DB_PATH in dbPath.js
const dbPathFile = path.join(process.cwd(), "utils", "dbPath.js");
const dbPathContent = `
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = path.join(__dirname, "../server/vector_store/unified_chunks.db");
console.log("✅ DB_PATH resolved to:", DB_PATH);
`;
fs.writeFileSync(dbPathFile, dbPathContent);
console.log("✅ dbPath.js restored");

// Step 2: Ensure vector_store folder exists
const vectorStoreDir = path.join(process.cwd(), "server", "vector_store");
if (!fs.existsSync(vectorStoreDir)) fs.mkdirSync(vectorStoreDir, { recursive: true });
console.log("✅ vector_store folder exists");

// Step 3: Restore old DB from backup if missing
const dbFile = path.join(vectorStoreDir, "unified_chunks.db");
const backupDB = path.join(process.cwd(), "server", "server", "vector_store", "unified_chunks.db");

if (!fs.existsSync(dbFile) && fs.existsSync(backupDB)) {
    fs.copyFileSync(backupDB, dbFile);
    console.log("✅ DB restored from backup");
} else if (!fs.existsSync(dbFile)) {
    // If no backup, create empty DB
    fs.writeFileSync(dbFile, "");
    console.log("⚠️ DB created fresh (no backup found)");
} else {
    console.log("✅ DB already exists");
}

// Step 4: Verify table 'chunks'
const db = new sqlite3.Database(dbFile);
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) {
        console.error("❌ Cannot read DB:", err);
    } else {
        console.log("Tables in DB:", rows.map(r => r.name));
        if (!rows.some(r => r.name === "chunks")) {
            console.log("⚠️ 'chunks' table missing. You need to run init-db.js to recreate it.");
        } else {
            console.log("✅ 'chunks' table exists");
        }
    }
    db.close();
});

console.log("✅ Recovery script finished. Now test embed-chunks.ts and query-chunks.ts");
