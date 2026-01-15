import Database from 'better-sqlite3';
import { ChatMessage } from '../shared/types';
import crypto from 'crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/* ---------------- ESM-safe __dirname ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- Database setup ---------------- */
const memoryDir = path.join(__dirname, '../memory');
const dbPath = path.join(memoryDir, 'chat_memory.db');

/* ✅ ENSURE DIRECTORY EXISTS (CRITICAL FIX) */
if (!fs.existsSync(memoryDir)) {
  fs.mkdirSync(memoryDir, { recursive: true });
  console.log('✅ Memory directory created:', memoryDir);
}

/* Open database ONLY after directory exists */
const db = new Database(dbPath);

/* Create table if not exists */
db.prepare(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    sessionId TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL
  )
`).run();

/* Create index */
db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_sessionId
  ON chat_messages (sessionId)
`).run();

/* ---------------- Memory Service ---------------- */
export class MemoryService {
  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<ChatMessage> {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId,
      role,
      content: content ?? '',
      timestamp: new Date().toISOString(),
    };

    db.prepare(`
      INSERT INTO chat_messages (id, sessionId, role, content, timestamp)
      VALUES (@id, @sessionId, @role, @content, @timestamp)
    `).run(msg);

    return msg;
  }

  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    const rows = db.prepare(`
      SELECT * FROM chat_messages
      WHERE sessionId = ?
      ORDER BY timestamp ASC
    `).all(sessionId);

    return rows.map(r => ({
      ...r,
      timestamp: new Date(r.timestamp),
    }));
  }
}

/* ---------------- Export singleton ---------------- */
export const memoryService = new MemoryService();
