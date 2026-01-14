# server/utils/compute_embedding.py
import sys
import json
import numpy as np

def fake_embedding(text):
    # Placeholder: returns deterministic vector based on char codes
    vec = [ord(c) % 10 / 10 for c in text[:50]]
    while len(vec) < 50:
        vec.append(0.0)
    return vec

if __name__ == "__main__":
    prompt = " ".join(sys.argv[1:])
    embedding = fake_embedding(prompt)
    print(json.dumps(embedding))
