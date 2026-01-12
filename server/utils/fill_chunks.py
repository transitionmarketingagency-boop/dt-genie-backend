import sqlite3
import numpy as np
from sklearn.preprocessing import normalize
import json

# 1️⃣ Connect to the DB
conn = sqlite3.connect("server/vector_store/unified_chunks.db")
c = conn.cursor()

# 2️⃣ Sample training data (replace with your real text data)
training_data = [
    "We offer social media marketing.",
    "Our AI tools simplify digital marketing.",
    "We create CGI tours for real estate.",
    "We provide search engine optimization and Google Ads services."
]

# 3️⃣ Insert chunks into DB
for text in training_data:
    vector = normalize(np.random.rand(1, 512))  # replace with real embeddings later
    c.execute(
        "INSERT INTO chunks (content, embedding) VALUES (?, ?)",
        (text, json.dumps(vector.tolist()))
    )

conn.commit()
conn.close()

print("✅ Chunks table populated successfully.")
