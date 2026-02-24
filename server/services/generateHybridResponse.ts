// server/services/generateHybridResponse.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getTopChunks } from "../queryChunks.js";
import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { enforceBotName, BOT_NAME } from "../system/identity.js";
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
  const ONE_DAY = 24 * 60 * 60 * 1000;
  if (now - geminiUsage.lastReset > ONE_DAY) {
    geminiUsage.count = 0;
    geminiUsage.lastReset = now;
  }
  return geminiUsage.count < GEMINI_DAILY_LIMIT;
}
function markGeminiUsed() { geminiUsage.count++; }

/* ================= INTENT & STATIC RESPONSES ================= */
function normalize(text: string) {
  return text.toLowerCase().trim().replace(/[^\w\s]/gi, "");
}

const staticIntents = {
  greeting: ["hi", "hello", "hey", "who are you"],
  identity: ["who are you", "about yourself", "tell me about yourself"],
  service: ["service", "services", "what services", "list services", "cgi ads", "youtube ads"],
  pricing: ["pricing", "price", "cost", "how much", "package", "tiers"],
  tagline: ["tagline", "slogan"],
  targetMarket: ["target market", "ideal client", "who do you serve"],
  mission: ["mission"],
  niches: ["niches", "specialize", "industry"]
};

const greetingVariations = [
  `Hello! How can I assist you today?`,
  `Hi there! Ready to guide your business growth with AI-powered strategies.`,
  `Greetings! Let's explore how to accelerate your business digitally.`
];

/* ================= PERSONA ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const personaPath = path.join(process.cwd(), "personas", "neon-vision.json");
let systemPersona: any = { tone: "professional, strategic, confident" };
if (fs.existsSync(personaPath)) {
  try { 
    systemPersona = JSON.parse(fs.readFileSync(personaPath, "utf-8")); 
    console.log("✅ Persona loaded"); 
  }
  catch { console.warn("⚠️ Failed to load persona, using default tone"); }
}

/* ================= AI LOGIC INTENTS ================= */
const aiLogicRoot = path.join(process.cwd(), "server", "ai_logic_converted");
const aiIntents: any[] = [];
function loadJSONRecursive(dir: string) {
  if (!fs.existsSync(dir)) {
    console.warn(`⚠️ AI logic folder not found: ${dir}`);
    return;
  }
  for (const f of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, f);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) loadJSONRecursive(fullPath);
    else if (f.endsWith(".json")) {
      try {
        const json = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
        if (json && Array.isArray(json.triggers) && Array.isArray(json.responses)) aiIntents.push(json);
        else console.warn(`⚠️ Skipped invalid intent JSON (missing triggers/responses): ${fullPath}`);
      } catch (err) { console.warn(`⚠️ Failed to parse JSON file: ${fullPath}`, err); }
    }
  }
}
loadJSONRecursive(aiLogicRoot);
console.log(`✅ Loaded ${aiIntents.length} AI logic JSON intents from ${aiLogicRoot}`);

/* ================= FIND MATCHING INTENT ================= */
function findMatchingIntent(userMessage: string) {
  const msg = normalize(userMessage);
  for (const intent of aiIntents) {
    for (const trig of intent.triggers) {
      if (msg.includes(normalize(trig))) return intent.responses.join("\n\n");
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
    "i am just an ai",
    "i don’t currently have confirmed information"
  ];
  return blockPhrases.some(p => lower.includes(p));
}

/* ================= EMBEDDING CACHE ================= */
const EMB_CACHE_FILE = path.join(__dirname, ".embeddingCache.json");
let embeddingCache: Map<string, string> = new Map();
try {
  if (fs.existsSync(EMB_CACHE_FILE)) {
    const raw = fs.readFileSync(EMB_CACHE_FILE, "utf-8");
    embeddingCache = new Map(Object.entries(JSON.parse(raw)));
    console.log(`✅ Loaded persistent embedding cache (${embeddingCache.size} entries)`);
  }
} catch { console.warn("⚠️ Failed to load embedding cache, starting fresh."); }

function saveEmbeddingCache() {
  try { fs.writeFileSync(EMB_CACHE_FILE, JSON.stringify(Object.fromEntries(embeddingCache)), "utf-8"); }
  catch { console.warn("⚠️ Failed to save embedding cache."); }
}

async function getCachedEmbeddings(userMessage: string) {
  const chunks: any[] = [];
  try {
    const allChunks = await getTopChunks(userMessage, 20, 0.25);
    let charCount = 0, MAX_CHARS = 12000;
    for (const c of allChunks) {
      let text = c.text || "";
      if (embeddingCache.has(text)) text = embeddingCache.get(text)!;
      else embeddingCache.set(text, text);
      if (charCount + text.length > MAX_CHARS) break;
      chunks.push({ ...c, text });
      charCount += text.length;
    }
    saveEmbeddingCache();
  } catch (err) { console.warn("⚠️ Embedding retrieval failed:", err); }
  return chunks.map(c => `[Source:${c.source||"unknown"}] ${c.text || ""}`).join("\n\n");
}

/* ================= DYNAMIC SERVICE & PRICING ================= */
async function dynamicServiceAnswer(userMessage: string, userId: string): Promise<string> {
  const embeddingKnowledge = await getCachedEmbeddings(userMessage);
  const jsonKnowledge = findMatchingIntent(userMessage);
  const combined = [embeddingKnowledge, jsonKnowledge].filter(Boolean).join("\n\n");
  const prompt = `You are ${BOT_NAME}, expert AI for Digital Transition Marketing.
Provide concise, expert-level, bullet-pointed response on services. Use company knowledge: ${combined}
User Query: ${userMessage}`;
  let response = cleanResponse(await generateGemma(prompt));
  if (!response || isNonAnswer(response)) response = "I don’t currently have confirmed information on that.";
  await memoryService.addMessage(userId, "assistant", response);
  return response;
}

async function dynamicPricingAnswer(userMessage: string, userId: string): Promise<string> {
  const embeddingKnowledge = await getCachedEmbeddings(userMessage);
  const jsonKnowledge = findMatchingIntent(userMessage);
  const combined = [embeddingKnowledge, jsonKnowledge].filter(Boolean).join("\n\n");
  const prompt = `You are ${BOT_NAME}, expert AI for Digital Transition Marketing.
Provide concise, context-aware pricing based on company knowledge: ${combined}
User Query: ${userMessage}`;
  let response = cleanResponse(await generateGemma(prompt));
  if (!response || isNonAnswer(response)) response = "I don’t currently have confirmed pricing information.";
  await memoryService.addMessage(userId, "assistant", response);
  return response;
}

/* ================= MAIN RESPONSE ================= */
export async function generateHybridResponse(userMessage: string, userId = "default-session"): Promise<string> {
  try {
    await memoryService.addMessage(userId, "user", userMessage);
    const msg = normalize(userMessage);

    // STATIC ROUTING
    if (staticIntents.greeting.includes(msg)) {
      const r = greetingVariations[Math.floor(Math.random() * greetingVariations.length)];
      await memoryService.addMessage(userId, "assistant", r);
      return r;
    }
    if (staticIntents.identity.some(t => msg.includes(t))) {
      const r = `I guide businesses through AI-driven marketing, automation, performance advertising, and digital growth systems.`;
      await memoryService.addMessage(userId, "assistant", r);
      return r;
    }
    if (staticIntents.service.some(t => msg.includes(t))) return await dynamicServiceAnswer(userMessage, userId);
    if (staticIntents.pricing.some(t => msg.includes(t))) return await dynamicPricingAnswer(userMessage, userId);

    const staticMap: Record<string,string> = {
      tagline: "Transitioning your business to the digital age.",
      targetMarket: "Ideal clients: • Real Estate Developers & Agencies • Travel & Tourism Agencies • E-commerce Brands",
      mission: "Our mission is to empower businesses to dominate the digital future using AI-driven systems, automation, and performance strategy.",
      niches: "Specialties: • Real Estate — CGI ads & virtual property tours • Travel & Tourism — AI marketing & automation • E-commerce — scalable growth systems & paid acquisition"
    };
    for (const key of ["tagline","targetMarket","mission","niches"]) {
      if (staticIntents[key].some(t => msg.includes(t))) {
        const response = staticMap[key];
        await memoryService.addMessage(userId, "assistant", response);
        return response;
      }
    }

    // =================== FIXED HYBRID FLOW ===================
    const jsonKnowledge = findMatchingIntent(userMessage) || "";
    const embeddingKnowledge = await getCachedEmbeddings(userMessage);
    const combinedKnowledge = [jsonKnowledge, embeddingKnowledge].filter(Boolean).join("\n\n");
    const history = await memoryService.getHistory(userId);
    const shortHistory = history.slice(-20).map(h => h.content).join("\n") || "None";

    const prompt = `You are expert AI for Digital Transition Marketing. Represent company knowledge and never mention AI model.
COMPANY KNOWLEDGE: ${combinedKnowledge || "No direct knowledge available."}
RECENT CONTEXT: ${shortHistory}
USER QUESTION: ${userMessage}
Respond strategically, concisely, and accurately based on official knowledge.`;

    let response = cleanResponse(await generateGemma(prompt));
    let modelUsed = "Gemma";

    if (!response || isNonAnswer(response)) {
      if (canUseGemini()) {
        try {
          const geminiResponse = await generateGemini(prompt);
          response = cleanResponse(geminiResponse);
          markGeminiUsed();
          modelUsed = "Gemini";
        } catch { console.warn("⚠️ Gemini fallback failed"); }
      }
    }

    response = enforceBotName(response);

    // CALENDLY FALLBACK ONLY ON EXPLICIT REQUEST
    if (!response || isNonAnswer(response)) {
      if (msg.includes("book") || msg.includes("call") || msg.includes("schedule")) {
        response = "Sure — you can book a call here: https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future";
      } else {
        response = "I don’t currently have confirmed information on that.";
      }
    }

    console.log(`[Hybrid] Model=${modelUsed}, UserMessage="${userMessage}"`);
    await memoryService.addMessage(userId, "assistant", response);

    return formatResponse(null, [{ content: response }], {});
  } catch (err) {
    console.error("Hybrid error FULL:", err);
    return "We’re experiencing a temporary processing issue, but I can still guide you strategically.";
  }
}
