// server/utils/diagnosticQwenTest.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { cosineSimilarity } from "../queryChunks.js";
import dotenv from "dotenv";

dotenv.config();

/* ================= PATHS ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CHUNKS_PATH = path.resolve(__dirname, "../vector_store/chunks.json");

/* ================= LOAD CHUNKS ================= */
function loadChunks(): { text: string; source: string | null; embedding: number[] }[] {
  if (!fs.existsSync(CHUNKS_PATH)) {
    console.error("[Diagnostic] chunks.json not found:", CHUNKS_PATH);
    return [];
  }

  const raw = fs.readFileSync(CHUNKS_PATH, "utf-8");
  const parsed = JSON.parse(raw);

  return parsed
    .filter((c: any) => c?.text && Array.isArray(c.embedding))
    .map((c: any) => ({
      text: c.text,
      source: typeof c.source === "string" ? c.source : null,
      embedding: c.embedding.map(Number),
    }));
}

/* ================= QUERY TOP CHUNKS ================= */
function getTopChunks(
  queryEmbedding: number[],
  chunks: { text: string; source: string | null; embedding: number[] }[],
  limit = 6
) {
  const scored = chunks.map(c => ({
    text: c.text,
    source: c.source,
    score: cosineSimilarity(queryEmbedding, c.embedding),
  }));

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/* ================= OPENROUTER CALL ================= */
async function callModel(prompt: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const apiUrl = "https://openrouter.ai/api/v1/chat/completions";

  if (!apiKey) throw new Error("OPENROUTER_API_KEY missing in .env");

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "DT-Genie-Diagnostic"
    },
    body: JSON.stringify({
      model: "qwen/qwen-2.5-72b-instruct",  // High quality + stable
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
You are a strict AI system.
You MUST answer ONLY using the provided context.
If information is not in context, say:
"Information not found in knowledge base."
Do NOT invent tools, pricing, integrations, or systems.
          `
        },
        {
          role: "user",
          content: prompt
        }
      ]
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Model API error ${response.status}: ${text}`);
  }

  const data: any = await response.json();
  return data.choices?.[0]?.message?.content ?? "[No response]";
}

/* ================= MAIN ================= */
async function main() {
  const testQuery = "List all company services with details and pricing";

  const chunks = loadChunks();
  if (chunks.length === 0) {
    console.error("[Diagnostic] No chunks loaded.");
    return;
  }

  console.log(`[Diagnostic] Loaded ${chunks.length} chunks.`);

  // ⚠️ IMPORTANT: For real system you should embed the query
  const queryEmbedding = chunks[0].embedding; // placeholder

  const topChunks = getTopChunks(queryEmbedding, chunks);

  console.log("\n===== TOP CHUNKS =====");
  topChunks.forEach((c, i) => {
    console.log(`${i + 1}. Score=${c.score.toFixed(3)} | ${c.text.slice(0, 120)}...`);
  });

  // Inject context
  const context = topChunks.map(c => c.text).join("\n\n");

  const finalPrompt = `
CONTEXT:
${context}

QUESTION:
${testQuery}

Answer strictly using the context above.
`;

  try {
    const response = await callModel(finalPrompt);

    console.log("\n===== HYBRID GROUNDED RESPONSE =====");
    console.log(response);
  } catch (err) {
    console.error("[Diagnostic] Model call failed:", err);
  }
}

main();
