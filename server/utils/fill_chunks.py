import sqlite3
import os

DB_PATH = os.getenv(
    "DB_PATH",
    os.path.join("dist", "server", "vector_store", "unified_chunks.db")
)

def ensure_dir():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

def table_exists(conn, table_name):
    cur = conn.cursor()
    cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?;",
        (table_name,)
    )
    return cur.fetchone() is not None

def main():
    ensure_dir()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    if table_exists(conn, "chunks"):
        print("✅ chunks table already exists — skipping init")
        conn.close()
        return

    print("⚠️ chunks table missing — creating")

    cur.execute("""
    CREATE TABLE chunks(
        id INTEGER PRIMARY KEY,
        page_url TEXT,
        heading TEXT,
        content TEXT,
        embedding TEXT
    )
    """)

    cur.execute("""
        INSERT INTO chunks (page_url, heading, content, embedding)
        VALUES (?, ?, ?, ?)
    """, (
        "https://digitaltransitionmarketing.com",
        "Digital Transition Marketing",
        "We offer AI, marketing, automation, real estate, travel, and growth solutions.",
        "[]"
    ))

    conn.commit()
    conn.close()
    print("✅ chunks table created")

if __name__ == "__main__":
    main()
