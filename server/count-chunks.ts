import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { DB_PATH } from "./utils/dbPath.js";

async function countChunks() {
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  const row = await db.get("SELECT COUNT(*) as count FROM chunks");
  console.log("Total chunks in DB:", row.count);
  await db.close();
}

countChunks();
