import sqlite3
import json
import numpy as np
from pathlib import Path

DB_PATH = "server/vector_store/vector_store.db"

def cosine_similarity(a, b):
    a = np.array(a, dtype=np.float32)
    b = np.array(b, dtype=np.float32)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10)

def load_embeddings():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT content, embedding FROM embeddings")
    rows = c.fetchall()
    conn.close()

    embeddings = []
    for row in rows:
        try:
            emb = json.loads(row["embedding"])
            embeddings.append({"content": row["content"], "embedding": emb})
        except Exception as e:
            print(f"⚠️ Error parsing embedding: {e}")
    return embeddings

def query_bot(user_embedding, embeddings, top_k=1, threshold=0.55):
    results = []
    for item in embeddings:
        sim = cosine_similarity(user_embedding, item["embedding"])
        if sim >= threshold:
            results.append((sim, item["content"]))
    results.sort(reverse=True, key=lambda x: x[0])
    return [r[1] for r in results[:top_k]]

if __name__ == "__main__":
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer("all-MiniLM-L6-v2")
    embeddings_db = load_embeddings()

    questions = [
        "What are all your core services?",
        "Tell me about AI-Optimized Content Creation & Repurposing.",
        "Which niches do you serve?",
        "What is Digital Transition Marketing's tagline?",
        "How do you manage social media for clients?",
        "What tools do you use for AI content generation?",
    ]

    for q in questions:
        q_emb = model.encode(q).tolist()
        matches = query_bot(q_emb, embeddings_db, top_k=2)
        print(f"\n❓ Question: {q}")
        if matches:
            print("💡 Answer:", matches[0])
        else:
            print("⚠️ No good match found — fallback triggered")
