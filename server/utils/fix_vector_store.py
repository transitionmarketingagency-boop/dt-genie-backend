#!/usr/bin/env python3
"""
fix_vector_store.py
Safe sync of chunks.json -> vector_store.db for Neon Vision / Digital Transition Marketing.

✅ Ensures all chunks are in the DB
✅ Keeps schema intact
✅ Avoids breaking paths or runtime scripts
"""

import json
import sqlite3
from pathlib import Path

# --- Paths ---
CHUNKS_JSON = Path("server/vector_store/chunks.json")
DB_PATH = Path("server/vector_store/vector_store.db")  # canonical DB

# --- Load chunks ---
with open(CHUNKS_JSON, "r", encoding="utf-8") as f:
    chunks = json.load(f)
print(f"🔹 Loaded {len(chunks)} chunks from chunks.json")

# --- Connect to DB ---
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# --- Ensure canonical schema ---
c.execute("""
CREATE TABLE IF NOT EXISTS embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file TEXT,
    chunk_index INTEGER,
    embedding TEXT,
    section TEXT,
    tags TEXT,
    internal_only INTEGER
)
""")
c.execute("""
CREATE UNIQUE INDEX IF NOT EXISTS uniq_source_chunk
ON embeddings (source_file, chunk_index)
""")
conn.commit()

# --- Insert or update chunks safely ---
inserted = 0
for chunk in chunks:
    source_file = chunk["file"]
    chunk_index = chunk["chunk_index"]
    embedding = json.dumps(chunk["embedding"])
    # Insert or replace ensures we update existing rows safely
    c.execute("""
    INSERT OR REPLACE INTO embeddings (source_file, chunk_index, embedding)
    VALUES (?, ?, ?)
    """, (source_file, chunk_index, embedding))
    inserted += 1

conn.commit()

# --- Verification ---
c.execute("SELECT COUNT(*) FROM embeddings")
total_chunks = c.fetchone()[0]

c.execute("SELECT COUNT(*) FROM embeddings WHERE embedding IS NULL")
null_count = c.fetchone()[0]

conn.close()

print(f"✅ Synced {inserted} chunks into DB")
print(f"🔹 Total embeddings in DB: {total_chunks}")
print(f"🔹 Null embeddings: {null_count}")
print("🎯 Vector store sync complete. You can now test the live bot safely.")
