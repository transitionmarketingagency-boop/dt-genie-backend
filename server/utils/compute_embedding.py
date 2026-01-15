# server/utils/compute_embedding.py
import sys
import json
from openai import OpenAI

# ------------------ CONFIG ------------------
client = OpenAI(api_key="YOUR_OPENAI_API_KEY")  # or os.environ["OPENAI_API_KEY"]

# ------------------ FUNCTION ------------------
def compute_embedding(text):
    # Using OpenAI embeddings (text-embedding-3-large)
    resp = client.embeddings.create(
        model="text-embedding-3-large",
        input=text
    )
    return resp.data[0].embedding

# ------------------ MAIN ------------------
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python compute_embedding.py 'Your text here'")
        sys.exit(1)

    text = " ".join(sys.argv[1:])
    embedding = compute_embedding(text)
    print(embedding)
