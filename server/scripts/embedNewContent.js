// server/scripts/embedNewContent.js
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { execSync } from 'child_process';

const dbFile = path.join(process.cwd(), 'server/vector_store/vectors.db');
const db = new sqlite3.Database(dbFile);

function getEmbedding(text) {
  const output = execSync(
    `python server/utils/embed_text.py "${text.replace(/"/g, '\\"')}"`,
    { encoding: 'utf-8' }
  );
  return JSON.parse(output.replace(/'/g, '"'));
}

// Example: Update a chunk with embedding
const chunksFile = path.join(process.cwd(), 'server/data/chunks.json');
const chunks = JSON.parse(fs.readFileSync(chunksFile, 'utf-8'));

chunks.forEach((chunk, index) => {
  const embedding = getEmbedding(chunk.text);
  db.run(
    'INSERT OR REPLACE INTO embeddings (id, content, vector) VALUES (?, ?, ?)',
    [chunk.id, chunk.text, JSON.stringify(embedding)],
    (err) => {
      if (err) console.error('DB insert error:', err);
      else console.log(`Chunk ${chunk.id} embedded`);
    }
  );
});
