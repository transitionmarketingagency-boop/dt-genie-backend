import json
import sqlite3
from pathlib import Path

# Paths
CHUNKS_JSON = Path("server/vector_store/chunks.json")
NEW_DB = Path("server/vector_store/vector_store.db")  # canonical DB

# Load chunks
with open(CHUNKS_JSON, "r", encoding="utf-8") as f:
    chunks = json.load(f)

print(f"✅ Loaded {len(chunks)} chunks from chunks.json")

# Remove old DB if exists
if NEW_DB.exists():
    NEW_DB.unlink()
    print(f"Deleted old DB at {NEW_DB}")

# Create new DB
conn = sqlite3.connect(NEW_DB)
c = conn.cursor()

# Create table
c.execute("""
CREATE TABLE embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file TEXT,
    chunk_index INTEGER,
    embedding TEXT,
    section TEXT,
    tags TEXT,
    internal_only INTEGER,
    content TEXT
)
""")

# Create unique index
c.execute("""
CREATE UNIQUE INDEX uniq_source_chunk
ON embeddings (source_file, chunk_index)
""")

# Insert chunks
for chunk in chunks:
    c.execute("""
    INSERT INTO embeddings (source_file, chunk_index, embedding, content)
    VALUES (?, ?, ?, ?)
    """, (
        chunk["file"],
        chunk["chunk_index"],
        json.dumps(chunk["embedding"]),
        chunk["text"]
    ))

conn.commit()
conn.close()
print(f"✅ Created canonical DB at {NEW_DB} with {len(chunks)} chunks")
