import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";

const DB_PATH = path.join(process.cwd(), "vector_store/unified_chunks.db");

async function countChunks() {
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  const row = await db.get("SELECT COUNT(*) as count FROM chunks");
  console.log("Total chunks in DB:", row.count);
  await db.close();
}

countChunks();
