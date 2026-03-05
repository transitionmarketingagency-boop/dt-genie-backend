// server/utils/diagnosticQwenTest.ts
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { getEmbedding } from "../services/openRouterEmbeddingsClient.js"; // must return number[]
import { cosineSimilarity } from "../queryChunks.js";

dotenv.config(); // ✅ ensure .env is loaded

console.log(
  "🔑 OPENROUTER_API_KEY:",
  process.env.OPENROUTER_API_KEY ? "FOUND" : "MISSING"
);

/* ================= PATHS ================= */
const CHUNKS_PATH = path.resolve(
  process.cwd(),
  "server/vector_store/chunks.json"
);
const AI_LOGIC_PATH = path.resolve(process.cwd(), "server/ai_logic");

/* ================= LOAD CHUNKS ================= */
function loadChunks() {
  if (!fs.existsSync(CHUNKS_PATH)) {
    console.error("chunks.json not found:", CHUNKS_PATH);
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

/* ================= LOAD AI INTENTS ================= */
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

  let lastErr: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const embedding = await getEmbedding(text); // returns number[]
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error("Invalid embedding returned from OpenRouter");
      }
      return embedding;
    } catch (err) {
      console.warn(`⚠️ Qwen embedding attempt ${attempt} failed:`, err);
      lastErr = err;
    }
  }

  throw new Error("❌ Failed to generate embedding after retries: " + lastErr);
}

/* ================= TOP CHUNKS ================= */
function getTopChunks(queryEmbedding: number[], chunks: any[], limit = 8) {
  const scored = chunks.map((c) => ({
    text: c.text,
    source: c.source,
    score: cosineSimilarity(queryEmbedding, c.embedding),
  }));

  const sorted = scored.sort((a, b) => b.score - a.score).slice(0, limit);

  console.log("\n[Top Similarity Scores]");
  sorted.forEach((s) => console.log(s.score.toFixed(4)));

  return sorted;
}

/* ================= QWEN CALL ================= */
async function callQwen(contextChunks: any[], question: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY missing.");

  const context = contextChunks.map((c) => c.text).join("\n\n");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen/qwen-2.5-72b-instruct",
      temperature: 0,
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

/* ================= HYBRID RESPONSE ================= */
async function hybridResponse(query: string, intents: any[], chunks: any[]) {
  // 1️⃣ Intent match
  const intentMatch = intents.find((intent) =>
    intent.triggers.some((t: string) =>
      query.toLowerCase().includes(t.toLowerCase())
    )
  );

  if (intentMatch) {
    return "M-/ Intent Match:\n" + intentMatch.responses.join("\n");
  }

  // 2️⃣ Similarity search
  const queryEmbedding = await embedQuery(query);
  const topChunks = getTopChunks(queryEmbedding, chunks, 8);

  if (topChunks.length > 0 && topChunks[0].score > 0.75) {
    return "~B Similarity Match:\n" + topChunks.map((c) => c.text).join("\n\n");
  }

  // 3️⃣ Grounded Qwen
  return await callQwen(topChunks, query);
}

/* ================= MAIN ================= */
async function main() {
  const chunks = loadChunks();
  const intents = loadIntentsRecursive(AI_LOGIC_PATH);

  console.log(`[Diagnostic] Loaded ${chunks.length} chunks`);
  console.log(`[Diagnostic] Loaded ${intents.length} AI intents`);

  const testQueries = [
    "List all company services with details and pricing",
    "Tell me about CGI property tours",
    "What is your 90-day guarantee?",
    "Do you offer unlimited revisions?",
    "Explain how AI transforms marketing in 2026",
  ];

  for (const query of testQueries) {
    console.log("\n===== TEST QUERY =====");
    console.log("Query:", query);

    try {
      const response = await hybridResponse(query, intents, chunks);
      console.log("Response:\n", response);
    } catch (err) {
      console.error("❌ Failed to process query:", err);
    }
  }
}

main();
