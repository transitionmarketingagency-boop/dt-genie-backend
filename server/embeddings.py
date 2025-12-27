import argparse
import json
from sentence_transformers import SentenceTransformer

# Initialize the model
model = SentenceTransformer("all-MiniLM-L6-v2")

def generate_embedding(text):
    vec = model.encode(text)
    return vec.tolist()  # Convert numpy array to Python list

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate embeddings for a text")
    parser.add_argument("--text", type=str, required=True, help="Text to embed")
    args = parser.parse_args()

    embedding = generate_embedding(args.text)
    print(json.dumps(embedding))  # Output JSON so Node.js can read it
