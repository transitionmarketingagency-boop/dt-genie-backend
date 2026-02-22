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

/* ================= INTENT HANDLERS ================= */

function normalize(text: string) {
  return text.toLowerCase().trim();
}

function isGreeting(text: string) {
  const t = normalize(text);
  return ["hi", "hello", "hey", "who are you"].includes(t);
}

function isIdentityIntent(text: string) {
  const t = normalize(text);
  return (
    t.includes("who are you") ||
    t.includes("about yourself") ||
    t.includes("tell me about yourself")
  );
}

function isServiceIntent(text: string) {
  const t = normalize(text);
  return (
    t.includes("what services") ||
    t.includes("list services") ||
    t.includes("tell me about your services") ||
    t === "services" ||
    t.includes("how many services") ||
    t.includes("number of services")
  );
}

function isPricingIntent(text: string) {
  const t = normalize(text);
  return (
    t.includes("pricing") ||
    t.includes("price") ||
    t.includes("cost") ||
    t.includes("how much")
  );
}

function isTaglineIntent(text: string) {
  const t = normalize(text);
  return t.includes("tagline") || t.includes("slogan");
}

function isTargetMarketIntent(text: string) {
  const t = normalize(text);
  return (
    t.includes("target market") ||
    t.includes("ideal client") ||
    t.includes("who do you serve")
  );
}

function isMissionIntent(text: string) {
  return normalize(text).includes("mission");
}

function isNichesIntent(text: string) {
  const t = normalize(text);
  return (
    t.includes("niches") ||
    t.includes("specialize") ||
    t.includes("industry")
  );
}

/* ================= STATIC ANSWERS ================= */

function taglineAnswer() {
  return "Transitioning your business to the digital age.";
}

function serviceCountAnswer() {
  return `Digital Transition Marketing offers five core service pillars:

1. AI-Powered Marketing & Automation Systems
2. Performance Advertising (Google, Paid Social & Funnels)
3. SEO, AI SEO & Voice Search Optimization
4. CGI Ads & Virtual Property Tours
5. Analytics, Tracking & Growth Intelligence

Each pillar integrates into a scalable digital growth system designed for long-term performance.`;
}

function pricingAnswer() {
  return `Our pricing is customized based on:

• Scope of services
• Business size and objectives
• Required automation and growth systems

We develop tailored strategic proposals after understanding your goals and growth roadmap.`;
}

function targetMarketAnswer() {
  return `Our ideal clients include:

• Real Estate Developers & Agencies
• Travel & Tour Agencies
• E-commerce Brands

We work with businesses ready to scale through AI-driven digital systems.`;
}

function missionAnswer() {
  return `Our mission is to empower businesses to dominate the digital future using AI-driven systems, automation, and performance strategy.`;
}

function nichesAnswer() {
  return `Digital Transition Marketing specializes in:

• Real Estate — CGI ads & virtual property tours
• Travel & Tourism — AI marketing & automation
• E-commerce — scalable growth systems & paid acquisition`;
}

/* ================= PERSONA & AI INTENTS ================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const personaPath = path.join(__dirname, "../personas/neon-vision.json");
let systemPersona: any = { name: BOT_NAME, tone: "professional, strategic, confident" };
if (fs.existsSync(personaPath)) {
  try {
    systemPersona = JSON.parse(fs.readFileSync(personaPath, "utf-8"));
    console.log("✅ Persona loaded");
  } catch {
    console.warn("⚠️ Failed to load persona, using default tone");
  }
}

const intentFolder = path.join(__dirname, "../ai_logic/neon_vision");
const aiIntents: any[] = [];
if (fs.existsSync(intentFolder)) {
  const files = fs.readdirSync(intentFolder).filter(f => f.endsWith(".json"));
  for (const f of files) {
    try {
      aiIntents.push(JSON.parse(fs.readFileSync(path.join(intentFolder, f), "utf-8")));
    } catch {
      console.warn(`⚠️ Failed to load ${f}, skipping`);
    }
  }
  console.log(`✅ Loaded ${aiIntents.length} Neon Vision JSONs`);
}

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

/* ================= NON-ANSWER CHECK ================= */

function isNonAnswer(text: string) {
  if (!text) return true;
  const lower = text.toLowerCase();
  if (
    lower.includes("as a large language model") ||
    lower.includes("as an ai language model") ||
    lower.includes("i don't have access") ||
    lower.includes("i am just an ai")
  )
    return true;
  return false; // allow short factual answers
}

/* ================= EMBEDDING CACHE ================= */

const EMB_CACHE_FILE = path.join(__dirname, ".embeddingCache.json");
let embeddingCache: Map<string, string> = new Map();

try {
  if (fs.existsSync(EMB_CACHE_FILE)) {
    const raw = fs.readFileSync(EMB_CACHE_FILE, "utf-8");
    const obj = JSON.parse(raw);
    embeddingCache = new Map(Object.entries(obj));
    console.log(`✅ Loaded persistent embedding cache (${embeddingCache.size} entries)`);
  }
} catch {
  console.warn("⚠️ Failed to load embedding cache, starting fresh.");
}

function saveEmbeddingCache() {
  try {
    fs.writeFileSync(
      EMB_CACHE_FILE,
      JSON.stringify(Object.fromEntries(embeddingCache)),
      "utf-8"
    );
  } catch {
    console.warn("⚠️ Failed to save embedding cache.");
  }
}

async function getCachedEmbeddings(userMessage: string) {
  let chunks: any[] = [];
  try {
    const allChunks = await getTopChunks(userMessage, 20, 0.20); // lower threshold for niche queries
    const MAX_CHARS = 12000;
    let charCount = 0;
    for (const c of allChunks) {
      let text = c.text || "";
      if (embeddingCache.has(text)) {
        text = embeddingCache.get(text)!;
      } else {
        embeddingCache.set(text, text);
      }
      if (charCount + text.length > MAX_CHARS) break;
      chunks.push({ ...c, text });
      charCount += text.length;
    }
    saveEmbeddingCache();
  } catch (err) {
    console.warn("⚠️ Retrieval failed:", err);
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

    // ===== STATIC ROUTING =====
    if (isGreeting(userMessage)) {
      const r = `I’m ${BOT_NAME}, the AI operating system behind Digital Transition Marketing. How can I assist you today?`;
      await memoryService.addMessage(userId, "assistant", r);
      return r;
    }
    if (isIdentityIntent(userMessage)) {
      return await returnStatic(
        `I am ${BOT_NAME}, the strategic AI system representing Digital Transition Marketing. I guide businesses through AI-driven marketing, automation, performance advertising, and digital growth systems.`,
        userId
      );
    }
    if (isServiceIntent(userMessage)) return await returnStatic(serviceCountAnswer(), userId);
    if (isPricingIntent(userMessage)) return await returnStatic(pricingAnswer(), userId);
    if (isTaglineIntent(userMessage)) return await returnStatic(taglineAnswer(), userId);
    if (isTargetMarketIntent(userMessage)) return await returnStatic(targetMarketAnswer(), userId);
    if (isMissionIntent(userMessage)) return await returnStatic(missionAnswer(), userId);
    if (isNichesIntent(userMessage)) return await returnStatic(nichesAnswer(), userId);

    // ===== AI JSON + Embedding Retrieval =====
    const intentKnowledge = findMatchingIntent(userMessage);
    const embeddingKnowledge = await getCachedEmbeddings(userMessage);

    // ALWAYS merge static service knowledge for fallback
    const combinedKnowledge = [
      serviceCountAnswer(),
      intentKnowledge,
      embeddingKnowledge,
    ].filter(Boolean).join("\n\n");

    const history = await memoryService.getHistory(userId);
    const shortHistory = history.slice(-6).map(h => h.content).join("\n") || "None";

    const prompt = `
You are ${BOT_NAME}, the official AI system of Digital Transition Marketing.
You represent the company directly.
Never say you are an AI model.
Use strategic, confident, professional tone from persona.

COMPANY KNOWLEDGE:
${combinedKnowledge}

RECENT CONTEXT:
${shortHistory}

USER QUESTION:
${userMessage}

Provide a structured, expert-level response based on official services and brand knowledge.
`;

    // PRIMARY MODEL: Gemma
    let response = cleanResponse(await generateGemma(prompt));
    let modelUsed = "Gemma";

    // FALLBACK: Gemini only if truly empty
    if (!response || isNonAnswer(response)) {
      if (canUseGemini()) {
        try {
          const geminiResponse = await generateGemini(prompt);
          response = cleanResponse(geminiResponse);
          markGeminiUsed();
          modelUsed = "Gemini";
        } catch {
          console.warn("⚠️ Gemini fallback failed");
        }
      }
    }

    response = enforceBotName(response);
    console.log(`[Hybrid] Model=${modelUsed}`);
    await memoryService.addMessage(userId, "assistant", response);

    return formatResponse(null, [{ content: response }], {});
  } catch (err) {
    console.error("Hybrid error FULL:", err);
    return `We’re experiencing a temporary processing issue, but I can still guide you strategically.`;
  }
}

async function returnStatic(text: string, userId: string) {
  await memoryService.addMessage(userId, "assistant", text);
  return text;
}
