// server/utils/diagnosticQwenTest.ts
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { getTopChunks } from "../queryChunks.js";
import { getEmbedding } from "../services/openRouterEmbeddingsClient.js";

dotenv.config(); // Load .env

console.log(
  " ~Q OPENROUTER_API_KEY:",
  process.env.OPENROUTER_API_KEY ? "FOUND" : "MISSING"
);

/* ================= PATHS ================= */
const CHUNKS_PATH = path.resolve(
  process.cwd(),
  "server/vector_store/chunks.json"
);
const AI_INTENTS_DIR = path.resolve(process.cwd(), "server/ai_logic");

/* ================= LOAD CHUNKS ================= */
function loadChunks() {
  if (!fs.existsSync(CHUNKS_PATH)) {
    console.error("❌ chunks.json not found:", CHUNKS_PATH);
    return [];
  }

  const parsed = JSON.parse(fs.readFileSync(CHUNKS_PATH, "utf-8"));

  return parsed
    .filter((c: any) => c?.text && Array.isArray(c.embedding))
    .map((c: any) => ({
      text: c.text,
      source: c.source ?? null,
      embedding: c.embedding.map(Number),
    }));
}

/* ================= LOAD INTENTS ================= */
function loadIntentsRecursive(dir: string, intents: any[] = []) {
  if (!fs.existsSync(dir)) return intents;

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      loadIntentsRecursive(fullPath, intents);
      continue;
    }

    if (!file.endsWith(".json")) continue;

    try {
      const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          if (item?.examples && item?.response) {
            intents.push({ triggers: item.examples, responses: [item.response] });
          } else if (item?.triggers && item?.responses) {
            intents.push(item);
          }
        });
      }
    } catch {
      console.warn("Failed loading:", fullPath);
    }
  }

  return intents;
}

/* ================= EMBED QUERY ================= */
async function embedQuery(text: string): Promise<number[]> {
  if (!text || !text.trim()) return [];

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY missing.");

  try {
    const embedding = await getEmbedding(text);
    if (!embedding || !Array.isArray(embedding)) throw new Error("Invalid embedding");
    return embedding;
  } catch (err) {
    console.error("❌ Embedding failed:", err);
    return [];
  }
}

/* ================= COSINE SIMILARITY ================= */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i], b = vecB[i];
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

/* ================= TOP CHUNKS ================= */
function getTopChunksLocal(queryEmbedding: number[], chunks: any[], limit = 8) {
  const scored = chunks.map(c => ({
    text: c.text,
    source: c.source,
    score: cosineSimilarity(queryEmbedding, c.embedding),
  }));
  const sorted = scored.sort((a, b) => b.score - a.score).slice(0, limit);

  console.log("\n[Top Similarity Scores]");
  sorted.forEach((s, i) => console.log(`#${i + 1}: ${s.score.toFixed(4)}`));

  return sorted;
}

/* ================= CALL QWEN ================= */
async function callQwen(contextChunks: any[], question: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY missing.");

  const context = contextChunks.map(c => c.text).join("\n\n");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen/qwen2.5-32b-instruct",
      temperature: 0.25,
      max_tokens: 500,
      top_p: 0.9,
      messages: [
        {
          role: "system",
          content:
            "Answer ONLY using provided context. If missing, say: Information not found in knowledge base.",
        },
        { role: "user", content: `CONTEXT:\n${context}\n\nQUESTION:\n${question}` },
      ],
    }),
  });

  const data: any = await response.json();
  return data.choices?.[0]?.message?.content ?? "No response";
}

/* ================= DIAGNOSTIC TEST ================= */
export async function diagnosticQwenTest(question: string) {
  const chunks = loadChunks();
  const intents = loadIntentsRecursive(AI_INTENTS_DIR);

  console.log("\n📌 Running diagnostic test for question:", question);

  // 1️⃣ Check intents
  const intentMatch = intents.find(intent =>
    intent.triggers.some((t: string) => question.toLowerCase().includes(t.toLowerCase()))
  );

  if (intentMatch) {
    console.log("\n[MATCHED INTENT]:", intentMatch.responses.join("\n"));
  }

  // 2️⃣ Similarity search
  const queryEmbedding = await embedQuery(question);
  const topChunks = getTopChunksLocal(queryEmbedding, chunks, 8);

  // 3️⃣ Call Qwen
  const qwenResponse = await callQwen(topChunks, question);
  console.log("\n[QWEN RESPONSE]:\n", qwenResponse);

  return qwenResponse;
}

/* ================= RUN DIRECTLY ================= */
if (import.meta.url === `file://${process.argv[1]}`) {
  const testQuery = "Tell me about our CGI property marketing services.";
  diagnosticQwenTest(testQuery).then(() => {
    console.log("\n[Diagnostic Complete]");
  });
}
