import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { DB_PATH } from "../utils/dbPath.js";

// ---------------- Utility: Split text into chunks ----------------
function splitText(text, maxLength = 500) {
  const sentences = text.split(/(?<=[.?!])\s+/);
  const chunks = [];
  let buffer = "";
  for (const s of sentences) {
    if ((buffer + " " + s).length > maxLength) {
      chunks.push(buffer.trim());
      buffer = s;
    } else {
      buffer += " " + s;
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks;
}

// ---------------- Embed & Insert ----------------
async function embedMarkdown(filePath) {
  const text = fs.readFileSync(filePath, "utf-8");
  const chunks = splitText(text);

  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });

  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];
    // For now, generate dummy embeddings — replace with Gemma embeddings later if needed
    const embedding = Array(768).fill(0.01); 

    await db.run(
      "INSERT INTO chunks (source_file, chunk_index, embedding, section, tags, internal_only) VALUES (?, ?, ?, ?, ?, ?)",
      [
        filePath,
        i,
        JSON.stringify(embedding),
        path.basename(path.dirname(filePath)),
        "ai_marketing",
        0
      ]
    );
  }

  await db.close();
  console.log(`✅ Embedded ${chunks.length} chunks from ${filePath}`);
}

// ---------------- Run ----------------
const filePath = path.resolve("server/knowledge_base/08_ai_marketing/ai_marketing_overview.md");
embedMarkdown(filePath).catch(console.error);
