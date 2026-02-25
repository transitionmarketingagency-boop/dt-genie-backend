# server/utils/embed_text.py
import sys
import json
from sentence_transformers import SentenceTransformer

# --- LOAD MODEL ONCE ---
model = SentenceTransformer('all-MiniLM-L6-v2')

def embed_text(text: str):
    if not text or not text.strip():
        return []
    embedding = model.encode(text).tolist()  # convert numpy array to list
    return embedding

def main():
    # Expect a single --text argument
    args = sys.argv
    if "--text" not in args:
        print(json.dumps([]))  # return empty list if no text
        return
    idx = args.index("--text")
    if idx + 1 >= len(args):
        print(json.dumps([]))
        return

    text = args[idx + 1]
    emb = embed_text(text)
    print(json.dumps(emb))  # Node.js will parse this JSON

if __name__ == "__main__":
    main()
