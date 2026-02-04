import os
import json
from server.embeddings import embed_and_store

# Path to your knowledge base
KB_PATH = r"C:\Users\hp\Desktop\DT-Genie_KB_Raw\NeonVision-KnowledgeBase\knowledge_sources"

# Optional: Chunk size if you want to split large files
CHUNK_SIZE = 500  # characters per chunk

def get_md_files(path):
    """Return all .md files in the directory"""
    files = []
    for fname in os.listdir(path):
        if fname.endswith(".md"):
            files.append(os.path.join(path, fname))
    return files

def read_file_chunks(file_path, chunk_size=CHUNK_SIZE):
    """Read file and split into chunks"""
    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()
    # Split text into chunks of approx chunk_size
    chunks = [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]
    return chunks

def main():
    md_files = get_md_files(KB_PATH)
    total_chunks = 0

    for md_file in md_files:
        fname = os.path.basename(md_file)
        try:
            chunks = read_file_chunks(md_file)
        except Exception as e:
            print(f"[SKIP] Could not read {fname}: {e}")
            continue

        print(f"[INFO] Embedding {fname} in {len(chunks)} chunks...")

        for idx, chunk in enumerate(chunks):
            payload = {
                "text": chunk,
                "source_file": fname,
                "chunk_index": idx,
                "section": "",
                "tags": "",
                "internal_only": 0
            }
            embed_and_store(payload)
            total_chunks += 1

    print(f"[DONE] Embedding complete. Total chunks processed: {total_chunks}")

if __name__ == "__main__":
    main()
