// server/populate-chunks.ts
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import sqlite3 from 'sqlite3';

const dbFile = path.join(process.cwd(), 'server/vector_store/vectors.db');
const db = new sqlite3.Database(dbFile);

// Read chunks JSON
const chunksFile = path.join(process.cwd(), 'server/data/chunks.json');
const chunks = JSON.parse(fs.readFileSync(chunksFile, 'utf-8'));

// Function to get Python embedding
function getEmbedding(text: string) {
  const output = execSync(
    `python server/utils/embed_text.py "${text.replace(/"/g, '\\"')}"`,
    { encoding: 'utf-8' }
  );
  return JSON.parse(output.replace(/'/g, '"'));
}

// Populate DB
chunks.forEach((chunk: { id: string; text: string }) => {
  const embedding = getEmbedding(chunk.text);
  db.run(
    'INSERT OR REPLACE INTO embeddings (id, content, vector) VALUES (?, ?, ?)',
    [chunk.id, chunk.text, JSON.stringify(embedding)],
    (err) => {
      if (err) console.error('DB insert error:', err);
      else console.log(`Chunk ${chunk.id} inserted`);
    }
  );
});
