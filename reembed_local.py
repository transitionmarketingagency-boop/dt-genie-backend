import sqlite3
import json
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

# === CONFIG ===
DB_PATH = "./server/vector_store/unified_chunks.db"
MODEL_NAME = "all-MiniLM-L6-v2"  # Replace with the exact local model you used

model = SentenceTransformer(MODEL_NAME)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute("SELECT id, content FROM chunks")
rows = cursor.fetchall()

print(f"⚡ Re-embedding {len(rows)} chunks using {MODEL_NAME}...")

for row in tqdm(rows):
    chunk_id, content = row
    emb = model.encode(content).tolist()  # Convert to list for JSON storage
    emb_json = json.dumps(emb)
    cursor.execute(
        "UPDATE chunks SET embedding = ? WHERE id = ?",
        (emb_json, chunk_id)
    )

conn.commit()
conn.close()
print("✅ All chunks re-embedded locally!")
