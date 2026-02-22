// server/services/generateHybridResponse.ts

import { getTopChunks } from "../queryChunks.js";
import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { formatResponse } from "../utils/formatResponse.js";

/* ================= GEMINI HARD GATE ================= */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENABLED = Boolean(GEMINI_API_KEY && GEMINI_API_KEY.length > 20);
const GEMINI_DAILY_LIMIT = 20;
let geminiUsage = { count: 0, lastReset: Date.now() };

function canUseGemini(): boolean {
  if (!GEMINI_ENABLED) return false;
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  if (now - geminiUsage.lastReset > ONE_DAY) {
    geminiUsage.count = 0;
    geminiUsage.lastReset = now;
  }
  return geminiUsage.count < GEMINI_DAILY_LIMIT;
}

function markGeminiUsed() {
  geminiUsage.count++;
}

/* ================= INTENT ROUTERS ================= */
function isGreeting(text: string) {
  const t = text.toLowerCase().trim();
  return ["hi", "hello", "hey", "who are you"].includes(t);
}

/* ================= PERSISTENT EMBEDDING CACHE ================= */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EMB_CACHE_FILE = path.join(__dirname, ".embeddingCache.json");

let embeddingCache: Map<string, string> = new Map();
try {
  if (fs.existsSync(EMB_CACHE_FILE)) {
    const raw = fs.readFileSync(EMB_CACHE_FILE, "utf-8");
    const obj = JSON.parse(raw);
    embeddingCache = new Map(Object.entries(obj));
    console.log(`✅ Loaded persistent embedding cache (${embeddingCache.size} entries)`);
  }
} catch (err) {
  console.warn("⚠️ Failed to load persistent embedding cache, starting fresh.");
}

function saveEmbeddingCache() {
  try {
    fs.writeFileSync(
      EMB_CACHE_FILE,
      JSON.stringify(Object.fromEntries(embeddingCache)),
      "utf-8"
    );
  } catch (err) {
    console.warn("⚠️ Failed to save embedding cache:", err);
  }
}

async function getCachedEmbeddings(userMessage: string) {
  let chunks: any[] = [];
  try {
    const allChunks = await getTopChunks(userMessage, 10, 0.5);
    const MAX_CHARS = 8000; // increase limit to capture full service/sub-service info
    let charCount = 0;
    chunks = [];
    for (const c of allChunks) {
      let text = c.text || "";
      if (embeddingCache.has(text)) text = embeddingCache.get(text)!;
      else embeddingCache.set(text, text);
      if (charCount + text.length > MAX_CHARS) break;
      chunks.push({ ...c, text });
      charCount += text.length;
    }
    saveEmbeddingCache();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("⚠️ Retrieval failed, continuing without knowledge. Error:", msg);
  }
  return chunks.map(c => c.text || "").join("\n\n");
}

/* ================= NON-ANSWER CHECK ================= */
function isNonAnswer(text: string) {
  if (!text) return true;
  const lower = text.toLowerCase();
  if (text.trim().length < 40) return true;
  if (
    lower.includes("as a large language model") ||
    lower.includes("as an ai language model") ||
    lower.includes("i am an ai") ||
    lower.includes("i do not have access")
  ) return true;
  return false;
}

/* ================= MAIN RESPONSE ================= */
export async function generateHybridResponse(
  userMessage: string,
  userId = "default-session"
): Promise<string> {
  try {
    await memoryService.addMessage(userId, "user", userMessage);

    // Simple dynamic greeting
    if (isGreeting(userMessage)) {
      const r = `I’m ${BOT_NAME}, the AI operating system behind Digital Transition Marketing. How can I assist you today?`;
      await memoryService.addMessage(userId, "assistant", r);
      return r;
    }

    // ================= EMBEDDING-BASED KNOWLEDGE =================
    const embeddingKnowledge = await getCachedEmbeddings(userMessage);

    const history = await memoryService.getHistory(userId);
    const shortHistory = history.slice(-4).map(h => h.content).join("\n") || "None";

    const prompt = `
You are ${BOT_NAME}, the official AI system of Digital Transition Marketing.
You represent the company directly.
Never say you are an AI model.
Answer confidently and strategically.

COMPANY KNOWLEDGE (from refined embeddings, all services & sub-services):
${embeddingKnowledge || "Use only official knowledge from embedded data."}

IMPORTANT INSTRUCTIONS:
1. Always use the provided knowledge to answer questions.
2. Organize answers using service/sub-service hierarchy.
3. Do not invent services or capabilities.
4. Be structured, professional, and concise.

RECENT CONTEXT:
${shortHistory}

USER QUESTION:
${userMessage}

Provide a structured, expert-level response directly from the knowledge.
`;

    // PRIMARY MODEL: Gemma
    let response = cleanResponse(await generateGemma(prompt));
    let modelUsed = "Gemma";

    // FALLBACK MODEL: Gemini
    if (isNonAnswer(response) && canUseGemini()) {
      try {
        const geminiResponse = await generateGemini(prompt);
        response = cleanResponse(geminiResponse);
        markGeminiUsed();
        modelUsed = "Gemini";
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("⚠️ Gemini fallback failed. Error:", msg);
      }
    }

    // FINAL RETRY WITH Gemma
    if (isNonAnswer(response)) {
      response = cleanResponse(await generateGemma(prompt + "\n\nBe more detailed and specific using only the knowledge provided."));
      modelUsed = "Gemma-Retry";
    }

    response = enforceBotName(response);
    console.log(`[Hybrid] Model=${modelUsed}`);

    await memoryService.addMessage(userId, "assistant", response);

    return formatResponse(null, [{ content: response }], {});
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Hybrid error FULL:", msg);
    return `We’re experiencing a temporary processing issue, but I can still guide you strategically.`;
  }
}
