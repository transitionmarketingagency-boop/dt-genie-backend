// server/services/generateHybridResponse.ts
import { getTopChunks } from "../queryChunks.js"; // ✅ added .js
import { generateGemma } from "./gemmaClient.js"; // ✅ added .js
import { generateGemini } from "./geminiClient.js"; // ✅ added .js
import { memoryService } from "./memoryService.js"; // ✅ added .js
import { enforceBotName, BOT_NAME } from "../system/identity.js"; // ✅ added .js
import { cleanResponse } from "../utils/cleanResponse.js"; // ✅ added .js
import { formatResponse } from "../utils/formatResponse.js"; // ✅ added .js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/* ================= GEMINI CONFIG ================= */
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
  return text.toLowerCase().trim().replace(/[^\w\s]/gi, "");
}

function isGreeting(text: string) {
  const t = normalize(text);
  return ["hi", "hello", "hey", "who are you"].includes(t);
}
function isIdentityIntent(text: string) {
  const t = normalize(text);
  return t.includes("who are you") || t.includes("about yourself") || t.includes("tell me about yourself");
}
function isServiceIntent(text: string) {
  const t = normalize(text);
  return t.includes("service") || t.includes("what services") || t.includes("list services");
}
function isPricingIntent(text: string) {
  const t = normalize(text);
  return t.includes("pricing") || t.includes("price") || t.includes("cost") || t.includes("how much");
}
function isTaglineIntent(text: string) {
  const t = normalize(text);
  return t.includes("tagline") || t.includes("slogan");
}
function isTargetMarketIntent(text: string) {
  const t = normalize(text);
  return t.includes("target market") || t.includes("ideal client") || t.includes("who do you serve");
}
function isMissionIntent(text: string) {
  return normalize(text).includes("mission");
}
function isNichesIntent(text: string) {
  const t = normalize(text);
  return t.includes("niches") || t.includes("specialize") || t.includes("industry");
}

/* ================= STATIC ANSWERS ================= */
function taglineAnswer() {
  return "Transitioning your business to the digital age.";
}
function serviceCountAnswer() {
  return `Digital Transition Marketing offers 14 official AI-powered services:

1. Voice Search Optimization (VSO)
2. AI-Driven Email Marketing
3. AI-Powered YouTube Ad Domination
4. AI-Powered Website Design
5. AI Virtual Tours
6. AI-Powered Ad Warfare (Performance Marketing)
7. AI Business Automation & Agents
8. Next-Level Music Production
9. Immersive CGI Marketing
10. AI Video and Audio Production
11. AI-Optimized Content
12. AI-Powered Social Domination
13. AI Search Domination (GEO & AI SEO)
14. AI Predictive Analytics`;
}
function pricingAnswer() {
  return `Our pricing is customized based on scope, business size, and required growth systems. Tailored strategic proposals are provided after assessing client goals.`;
}
function targetMarketAnswer() {
  return `Ideal clients:

• Real Estate Developers & Agencies
• Travel & Tourism Agencies
• E-commerce Brands`;
}
function missionAnswer() {
  return `Our mission is to empower businesses to dominate the digital future using AI-driven systems, automation, and performance strategy.`;
}
function nichesAnswer() {
  return `Specialties:

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
  console.log(`✅ Loaded ${aiIntents.length} Neon Vision JSON intents`);
}

function findMatchingIntent(userMessage: string) {
  const msg = normalize(userMessage);
  for (const intent of aiIntents) {
    if (!intent || !intent.triggers || !intent.responses) continue;
    for (const trig of intent.triggers) {
      if (msg.includes(normalize(trig))) {
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
  const blockPhrases = [
    "as a large language model",
    "as an ai language model",
    "i don't have access",
    "i am just an ai"
  ];
  return blockPhrases.some(p => lower.includes(p));
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
    fs.writeFileSync(EMB_CACHE_FILE, JSON.stringify(Object.fromEntries(embeddingCache)), "utf-8");
  } catch {
    console.warn("⚠️ Failed to save embedding cache.");
  }
}

async function getCachedEmbeddings(userMessage: string) {
  let chunks: any[] = [];
  try {
    const allChunks = await getTopChunks(userMessage, 20, 0.25);
    console.log(`🟢 Retrieved ${allChunks.length} chunks for message: "${userMessage}"`);
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
    console.warn("⚠️ Embedding retrieval failed:", err);
  }
  return chunks.map(c => c.text || "").join("\n\n");
}

/* ================= STATIC HELPER ================= */
async function returnStatic(text: string, userId: string) {
  await memoryService.addMessage(userId, "assistant", text);
  return text;
}

/* ================= MAIN RESPONSE ================= */
export async function generateHybridResponse(userMessage: string, userId = "default-session"): Promise<string> {
  try {
    await memoryService.addMessage(userId, "user", userMessage);

    // ===== STATIC ROUTING =====
    if (isGreeting(userMessage)) {
      const r = `I’m ${BOT_NAME}, the AI operating system behind Digital Transition Marketing. How can I assist you today?`;
      await memoryService.addMessage(userId, "assistant", r);
      return r;
    }
    if (isIdentityIntent(userMessage))
      return await returnStatic(
        `I am ${BOT_NAME}, the strategic AI system representing Digital Transition Marketing. I guide businesses through AI-driven marketing, automation, performance advertising, and digital growth systems.`,
        userId
      );
    if (isServiceIntent(userMessage)) return await returnStatic(serviceCountAnswer(), userId);
    if (isPricingIntent(userMessage)) return await returnStatic(pricingAnswer(), userId);
    if (isTaglineIntent(userMessage)) return await returnStatic(taglineAnswer(), userId);
    if (isTargetMarketIntent(userMessage)) return await returnStatic(targetMarketAnswer(), userId);
    if (isMissionIntent(userMessage)) return await returnStatic(missionAnswer(), userId);
    if (isNichesIntent(userMessage)) return await returnStatic(nichesAnswer(), userId);

    // ===== AI JSON + Embedding Retrieval =====
    const intentKnowledge = findMatchingIntent(userMessage);
    const embeddingKnowledge = await getCachedEmbeddings(userMessage);

    const combinedKnowledge = [serviceCountAnswer(), intentKnowledge, embeddingKnowledge].filter(Boolean).join("\n\n");

    const history = await memoryService.getHistory(userId);
    const shortHistory = history.slice(-10).map(h => h.content).join("\n") || "None";

    const prompt = `
You are ${BOT_NAME}, the official AI system of Digital Transition Marketing.
Represent the company directly. Never say you are an AI model.
Use strategic, confident, professional tone from persona.

COMPANY KNOWLEDGE:
${combinedKnowledge}

RECENT CONTEXT:
${shortHistory}

USER QUESTION:
${userMessage}

Provide an expert-level response based on official services, persona, and brand knowledge.
Do NOT invent new services.
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
    console.log(`[Hybrid] Model=${modelUsed}, UserMessage="${userMessage}"`);
    await memoryService.addMessage(userId, "assistant", response);

    return formatResponse(null, [{ content: response }], {});
  } catch (err) {
    console.error("Hybrid error FULL:", err);
    return `We’re experiencing a temporary processing issue, but I can still guide you strategically.`;
  }
}
