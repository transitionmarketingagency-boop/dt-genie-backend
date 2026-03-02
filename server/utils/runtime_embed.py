from sentence_transformers import SentenceTransformer
import sys
import json

model = SentenceTransformer("all-MiniLM-L6-v2")

if __name__ == "__main__":
    text = " ".join(sys.argv[1:])
    embedding = model.encode(text).tolist()
    print(json.dumps(embedding))
