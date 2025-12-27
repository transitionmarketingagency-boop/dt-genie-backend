import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY!;
const EMBEDDING_URL =
  process.env.GEMINI_EMBEDDING_URL ||
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";

export async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${EMBEDDING_URL}?key=${API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: {
        parts: [{ text }],
      },
    }),
  });

  const raw = await res.text();

  if (!res.ok) {
    throw new Error(`Embedding error ${res.status}: ${raw}`);
  }

  const data = JSON.parse(raw);

  if (!data.embedding || !data.embedding.values) {
    throw new Error("Invalid embedding response: " + raw);
  }

  return data.embedding.values;
}

/* Optional local test (ESM-safe) */
if (process.argv[1]?.includes("embeddingClient.ts")) {
  getEmbedding("test embedding")
    .then(v => console.log("Vector length:", v.length))
    .catch(console.error);
}
