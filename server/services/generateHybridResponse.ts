// server/services/generateHybridResponse.ts

import { getEmbedding } from "../embeddings.js";
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

function isServicesIntent(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("services") ||
    t.includes("what do you do") ||
    t.includes("tell me about your company") ||
    t.includes("what does digital transition marketing")
  );
}

/* ================= STATIC TRUSTED ANSWERS ================= */

function servicesAnswer() {
  return `
Digital Transition Marketing helps businesses transition into the digital future using high-impact, AI-driven systems.

Our core services include:

• AI-powered marketing & automation systems  
• Performance advertising (Google, paid social, funnels)  
• SEO, AI SEO, and voice search optimization  
• CGI ads and virtual property tours for real estate  
• Analytics, tracking, and growth intelligence  
• Scalable growth strategies and systemized marketing execution  

We don’t just run campaigns — we build digital growth systems designed to scale.
`.trim();
}

/* ---------------- Persona loader ---------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const personaPath = path.join(__dirname, "../personas/neon-vision.json");

let systemPersona: any = {
  name: BOT_NAME,
  tone: "professional, clear, helpful",
};

if (fs.existsSync(personaPath)) {
  systemPersona = JSON.parse(fs.readFileSync(personaPath, "utf-8"));
  console.log("✅ Persona loaded");
}

/* ================= QUALITY CHECK ================= */

function isNonAnswer(text: string) {
  return !text || text.trim().length < 60;
}

/* ================= MAIN RESPONSE ================= */

export async function generateHybridResponse(
  userMessage: string,
  userId = "default-session"
): Promise<string> {
  try {
    await memoryService.addMessage(userId, "user", userMessage);

    /* ---------- GREETING ---------- */
    if (isGreeting(userMessage)) {
      const r = `I’m ${BOT_NAME}, the AI assistant for Digital Transition Marketing.`;
      await memoryService.addMessage(userId, "assistant", r);
      return r;
    }

    /* ---------- SERVICES ---------- */
    if (isServicesIntent(userMessage)) {
      const r = servicesAnswer();
      await memoryService.addMessage(userId, "assistant", r);
      return r;
    }

    /* ---------- DEEP AI FLOW ---------- */

    const embedding = await getEmbedding(userMessage);
    const chunks = await getTopChunks(embedding, 8);
    const history = await memoryService.getHistory(userId);

    const knowledge = chunks.map(c => c.content).join("\n\n");

    const context = `
You are ${systemPersona.name}.
Answer clearly and professionally.

CONVERSATION HISTORY:
${history.map(h => `${h.role}: ${h.content}`).join("\n")}

COMPANY KNOWLEDGE:
${knowledge}

USER QUESTION:
${userMessage}
`;

    let response = cleanResponse(await generateGemma(context));
    let modelUsed = "Gemma";

    if (isNonAnswer(response) && canUseGemini()) {
      try {
        response = cleanResponse(await generateGemini(context));
        markGeminiUsed();
        modelUsed = "Gemini";
      } catch {
        console.warn("⚠️ Gemini disabled or unavailable");
      }
    }

    if (isNonAnswer(response)) {
      response =
        "I can help with our services, AI systems, growth strategy, or automation solutions. What would you like to explore?";
    }

    response = enforceBotName(response);

    console.log(`[Hybrid] Model=${modelUsed}`);

    await memoryService.addMessage(userId, "assistant", response);
    return formatResponse(null, [{ content: response }], {});
  } catch (err) {
    console.error("Hybrid error:", err);
    return `Sorry — ${BOT_NAME} is temporarily unavailable.`;
  }
}
