import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Correct DB path (506 chunks version)
const dbPath = path.join(__dirname, "../server/vector_store/vector_store.db_506");

if (!fs.existsSync(dbPath)) {
  console.error("❌ vector_store.db_506 not found at:", dbPath);
  process.exit(1);
}

console.log("✅ Found DB:", dbPath);

const db = new sqlite3.Database(dbPath);

// Pull ALL chunks
db.all("SELECT text FROM chunks LIMIT 20", async (err, rows) => {
  if (err) {
    console.error("❌ DB error:", err);
    process.exit(1);
  }

  console.log("✅ Loaded chunks from DB:", rows.length);

  const knowledgeText = rows.map(r => r.text).join("\n\n");

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma",
        prompt: `You are Digital Transition Marketing AI.

Use the knowledge below to answer.

${knowledgeText}

Question: List all services.
Answer:`,
        stream: false
      })
    });

    const data = await response.json();

    console.log("\n🔥 GEMMA RESPONSE:\n");
    console.log(data.response);

  } catch (error) {
    console.error("❌ Gemma error:", error);
  }

  db.close();
});
