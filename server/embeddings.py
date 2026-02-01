import argparse
import json
import sqlite3
from sentence_transformers import SentenceTransformer

DB_PATH = "server/vector_store/vector_store.db"
model = SentenceTransformer("all-MiniLM-L6-v2")

def embed_and_store(text, source_file, chunk_index, section, tags, internal_only):
    embedding = model.encode(text).tolist()

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO embeddings
        (source_file, chunk_index, embedding, section, tags, internal_only)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            source_file,
            chunk_index,
            json.dumps(embedding),
            section,
            tags,
            internal_only,
        ),
    )
    conn.commit()
    conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--source_file", required=True)
    parser.add_argument("--chunk_index", type=int, required=True)
    parser.add_argument("--section", default="")
    parser.add_argument("--tags", default="")
    parser.add_argument("--internal_only", type=int, default=0)
    args = parser.parse_args()

    embed_and_store(
        args.text,
        args.source_file,
        args.chunk_index,
        args.section,
        args.tags,
        args.internal_only,
    )
