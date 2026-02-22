// server/services/generateHybridResponse.ts

import { getTopChunks } from "../queryChunks.js";
import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { formatResponse } from "../utils/formatResponse.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

function isServiceCountIntent(text: string) {
  const t = text.toLowerCase();
  return t.includes("how many services") || t.includes("number of services");
}

function isTaglineIntent(text: string) {
  const t = text.toLowerCase();
  return t.includes("tagline") || t.includes("slogan");
}

function isTargetMarketIntent(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("target market") ||
    t.includes("ideal client") ||
    t.includes("who do you serve")
  );
}

function isMissionIntent(text: string) {
  return text.toLowerCase().includes("mission");
}

function isNichesIntent(text: string) {
  const t = text.toLowerCase();
  return t.includes("niches") || t.includes("specialize") || t.includes("industry");
}

/* ================= STATIC ANSWERS ================= */

function taglineAnswer() {
  return "Transitioning your business to the digital age.";
}

function serviceCountAnswer() {
  return `
Digital Transition Marketing offers five core service pillars:

1. AI-Powered Marketing & Automation Systems
2. Performance Advertising (Google, Paid Social & Funnels)
3. SEO, AI SEO & Voice Search Optimization
4. CGI Ads & Virtual Property Tours
5. Analytics, Tracking & Growth Intelligence

Each service integrates into a scalable digital growth system designed for long-term performance.
`.trim();
}

function targetMarketAnswer() {
  return `
Our ideal clients include:

• Real Estate Developers & Agencies
• Travel and Tour Agencies
• E-commerce Brands

We work with businesses ready to scale through AI-driven digital systems.
`.trim();
}

function missionAnswer() {
  return `
Our mission is to empower businesses to dominate the digital future using AI-driven systems, automation, and performance strategy.
`.trim();
}

function nichesAnswer() {
  return `
Digital Transition Marketing specializes in:

• Real Estate — CGI ads & virtual property tours
• Travel & Tourism — AI marketing & automation
• E-commerce — Scalable growth systems & paid acquisition
`.trim();
}

/* ================= PERSONA LOADER ================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const personaPath = path.join(__dirname, "../personas/neon-vision.json");

let systemPersona: any = {
  name: BOT_NAME,
  tone: "professional, strategic, confident",
};

if (fs.existsSync(personaPath)) {
  try {
    systemPersona = JSON.parse(fs.readFileSync(personaPath, "utf-8"));
    console.log("✅ Persona loaded");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("⚠️ Persona JSON invalid, using fallback. Error:", msg);
  }
}

/* ================= AI INTENT JSON LOADER ================= */

const intentFolder = path.join(__dirname, "../ai_logic/neon_vision");
const aiIntents: any[] = [];

if (fs.existsSync(intentFolder)) {
  const files = fs.readdirSync(intentFolder).filter(f => f.endsWith(".json"));
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(intentFolder, f), "utf-8"));
      aiIntents.push(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ Failed to load ${f}:`, msg);
    }
  }
  console.log(`✅ Loaded ${aiIntents.length} Neon Vision JSONs`);
}

/* ================= QUALITY CHECK ================= */

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

/* ================= INTENT MATCHER ================= */

function findMatchingIntent(userMessage: string) {
  const msg = userMessage.toLowerCase();
  for (const intent of aiIntents) {
    if (!intent || !intent.triggers || !intent.responses) continue;
    for (const trig of intent.triggers) {
      if (msg.includes(trig.toLowerCase())) {
        return intent.responses.join("\n\n");
      }
    }
  }
  return null;
}

/* ================= PERSISTENT EMBEDDING CACHE ================= */

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
    const allChunks = await getTopChunks(userMessage, 0);
    const MAX_CHARS = 4000;
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

/* ================= MAIN RESPONSE ================= */

export async function generateHybridResponse(
  userMessage: string,
  userId = "default-session"
): Promise<string> {
  try {
    await memoryService.addMessage(userId, "user", userMessage);

    // STATIC INTENT HANDLERS
    if (isGreeting(userMessage)) {
      const r = `I’m ${BOT_NAME}, the AI operating system behind Digital Transition Marketing. How can I assist you today?`;
      await memoryService.addMessage(userId, "assistant", r);
      return r;
    }
    if (isServiceCountIntent(userMessage)) return await returnStatic(serviceCountAnswer(), userId);
    if (isTaglineIntent(userMessage)) return await returnStatic(taglineAnswer(), userId);
    if (isTargetMarketIntent(userMessage)) return await returnStatic(targetMarketAnswer(), userId);
    if (isMissionIntent(userMessage)) return await returnStatic(missionAnswer(), userId);
    if (isNichesIntent(userMessage)) return await returnStatic(nichesAnswer(), userId);

    // ================= INTENT MATCHING
    let intentKnowledge = findMatchingIntent(userMessage);

    // ================= EMBEDDING-BASED KNOWLEDGE =================
    const embeddingKnowledge = await getCachedEmbeddings(userMessage);

    // MERGE INTENT + EMBEDDING
    const knowledge = [intentKnowledge, embeddingKnowledge].filter(Boolean).join("\n\n");

    const history = await memoryService.getHistory(userId);
    const shortHistory = history.slice(-4).map(h => h.content).join("\n") || "None";

    const prompt = `
You are ${BOT_NAME}, the official AI system of Digital Transition Marketing.
You represent the company directly.
Never say you are an AI model.
Answer confidently and strategically.

COMPANY KNOWLEDGE:
${knowledge || "Use internal strategic reasoning."}

IMPORTANT:
If knowledge conflicts with official service structure,
prioritize the official 5 core service pillars of Digital Transition Marketing.
Do NOT invent additional services.

RECENT CONTEXT:
${shortHistory}

USER QUESTION:
${userMessage}

Provide a structured, expert-level response.
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
      response = cleanResponse(await generateGemma(prompt + "\n\nBe more detailed and specific."));
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

async function returnStatic(text: string, userId: string) {
  await memoryService.addMessage(userId, "assistant", text);
  return text;
}
