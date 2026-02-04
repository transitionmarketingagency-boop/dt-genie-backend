import sys
import json
import sqlite3
from sentence_transformers import SentenceTransformer

DB_PATH = "server/vector_store/vector_store.db"
model = SentenceTransformer("all-MiniLM-L6-v2")

def embed_and_store(payload):
    embedding = model.encode(payload["text"]).tolist()

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
    INSERT OR IGNORE INTO embeddings
    (source_file, chunk_index, embedding, section, tags, internal_only)
    VALUES (?, ?, ?, ?, ?, ?)
""", (
    payload["source_file"],
    payload["chunk_index"],
    json.dumps(embedding),
    payload["section"],
    payload["tags"],
    payload["internal_only"]
))

    conn.commit()
    conn.close()

if __name__ == "__main__":
    payload = json.load(sys.stdin)
    embed_and_store(payload)
