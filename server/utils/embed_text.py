import os
import json
from sentence_transformers import SentenceTransformer

# --- CONFIGURE CHUNKING ---
CHUNK_SIZE = 1000        # characters per chunk
CHUNK_OVERLAP = 200      # overlap between chunks
INPUT_DIR = "server/data/md"
OUTPUT_FILE = "server/vector_store/chunks.json"

# --- LOAD MODEL ---
model = SentenceTransformer('all-MiniLM-L6-v2')

# --- HELPER FUNCTION TO CHUNK TEXT ---
def chunk_text(text, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    chunks = []
    start = 0
    text_len = len(text)
    while start < text_len:
        end = min(start + chunk_size, text_len)
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

# --- COLLECT FILES ---
md_files = [f for f in os.listdir(INPUT_DIR) if f.endswith(".md")]
all_chunks = []

for filename in md_files:
    path = os.path.join(INPUT_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    chunks = chunk_text(content)
    for idx, chunk in enumerate(chunks):
        all_chunks.append({
            "file": filename,
            "chunk_index": idx,
            "text": chunk,
            "embedding": model.encode(chunk).tolist()  # convert numpy array to list for JSON
        })

# --- SAVE TO VECTOR STORE ---
os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(all_chunks, f, ensure_ascii=False, indent=2)

print(f"✅ Embedded {len(md_files)} files into {OUTPUT_FILE} ({len(all_chunks)} chunks)")
