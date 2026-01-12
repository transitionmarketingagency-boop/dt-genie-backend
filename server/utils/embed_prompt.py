# server/utils/embed_prompt.py
import sys
import json
from sklearn.preprocessing import normalize
import numpy as np

# Read prompt from stdin
prompt = sys.stdin.read().strip()

# Dummy embedding: vector length 2
vector = np.array([1.0, 1.0])

# Normalize vector
normed = normalize(vector.reshape(1, -1))[0]

# Output JSON array
print(json.dumps(normed.tolist()))
