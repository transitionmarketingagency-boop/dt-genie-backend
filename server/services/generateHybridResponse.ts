// server/services/generateHybridResponse.ts

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getTopChunks } from "../queryChunks.js";
import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { formatResponse } from "../utils/formatResponse.js";

/* ================= GEMINI CONFIG ================= */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENABLED = Boolean(GEMINI_API_KEY && GEMINI_API_KEY.length > 20);
const GEMINI_DAILY_LIMIT = 20;

let geminiUsage = { count: 0, lastReset: Date.now() };

function canUseGemini(): boolean {
  if (!GEMINI_ENABLED) return false;
  const now = Date.now();
  const ONE_DAY = 86400000;
  if (now - geminiUsage.lastReset > ONE_DAY) {
    geminiUsage.count = 0;
    geminiUsage.lastReset = now;
  }
  return geminiUsage.count < GEMINI_DAILY_LIMIT;
}

function markGeminiUsed() {
  geminiUsage.count++;
}

/* ================= NORMALIZER ================= */

function normalize(text: string) {
  return text.toLowerCase().trim().replace(/[^\w\s]/gi, "");
}

/* ================= LOAD AI JSON INTENTS ================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const aiLogicRoot = path.join(__dirname, "../ai_logic");

const aiIntents: any[] = [];

function loadJSONRecursive(dir: string) {
  if (!fs.existsSync(dir)) return;

  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      loadJSONRecursive(fullPath);
    } else if (file.endsWith(".json")) {
      try {
        const json = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
        if (json.triggers && json.responses) {
          aiIntents.push(json);
        }
      } catch {
        console.warn("⚠️ Failed to load intent:", fullPath);
      }
    }
  }
}

loadJSONRecursive(aiLogicRoot);
console.log(`✅ Loaded ${aiIntents.length} AI logic JSON intents`);

/* ================= INTENT MATCH ================= */

function findMatchingIntent(userMessage: string) {
  const msg = normalize(userMessage);

  for (const intent of aiIntents) {
    for (const trig of intent.triggers || []) {
      if (msg.includes(normalize(trig))) {
        return intent.responses.join("\n\n");
      }
    }
  }
  return null;
}

/* ================= WEAK RESPONSE CHECK ================= */

function isWeakResponse(text: string) {
  if (!text) return true;

  const lower = text.toLowerCase();

  if (
    lower.includes("as a large language model") ||
    lower.includes("i am just an ai") ||
    lower.length < 40
  ) {
    return true;
  }

  return false;
}

/* ================= EMBEDDING KNOWLEDGE ================= */

async function getEmbeddingKnowledge(userMessage: string) {
  try {
    const chunks = await getTopChunks(userMessage, 15, 0.25);

    if (!chunks || chunks.length === 0) return "";

    return chunks.map(c => c.text).join("\n\n");
  } catch (err) {
    console.warn("⚠️ Embedding retrieval failed:", err);
    return "";
  }
}

/* ================= MAIN HYBRID RESPONSE ================= */

export async function generateHybridResponse(
  userMessage: string,
  userId = "default-session"
): Promise<string> {
  try {
    await memoryService.addMessage(userId, "user", userMessage);

    /* ===== KNOWLEDGE COLLECTION ===== */

    const intentKnowledge = findMatchingIntent(userMessage);
    const embeddingKnowledge = await getEmbeddingKnowledge(userMessage);

    const combinedKnowledge = [intentKnowledge, embeddingKnowledge]
      .filter(Boolean)
      .join("\n\n");

    const history = await memoryService.getHistory(userId);
    const shortHistory = history.slice(-15).map(h => h.content).join("\n");

    /* ===== STRICT PROMPT ===== */

    const prompt = `
You are the official AI system of Digital Transition Marketing.

STRICT RULES:
- You are LIMITED to the COMPANY KNOWLEDGE provided below.
- Do NOT invent services.
- Do NOT create new pricing.
- Do NOT add capabilities not mentioned in knowledge.
- If answer is not clearly found in knowledge, say:
  "I don’t currently have confirmed information on that."

- Do NOT introduce yourself unless explicitly asked.
- Do NOT start responses with your name.
- Be professional, strategic, concise.

COMPANY KNOWLEDGE:
${combinedKnowledge || "None"}

RECENT CONTEXT:
${shortHistory || "None"}

USER QUESTION:
${userMessage}

Respond only using confirmed company knowledge.
`;

    let response = cleanResponse(await generateGemma(prompt));
    let modelUsed = "Gemma";

    if ((isWeakResponse(response) || !combinedKnowledge) && canUseGemini()) {
      try {
        response = cleanResponse(await generateGemini(prompt));
        markGeminiUsed();
        modelUsed = "Gemini";
      } catch {
        console.warn("⚠️ Gemini fallback failed");
      }
    }

    if (!response || isWeakResponse(response)) {
      response = "I don’t currently have confirmed information on that.";
    }

    console.log(`[Hybrid] Model=${modelUsed}, Query="${userMessage}"`);
    console.log(`[Hybrid] Knowledge Length=${combinedKnowledge.length}`);

    await memoryService.addMessage(userId, "assistant", response);

    return formatResponse(null, [{ content: response }], {});
  } catch (err) {
    console.error("Hybrid error FULL:", err);
    return "We’re experiencing a temporary processing issue.";
  }
}
