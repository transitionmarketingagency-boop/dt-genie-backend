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

function isServicesIntent(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("services") ||
    t.includes("what do you do") ||
    t.includes("tell me about your company") ||
    t.includes("what does digital transition marketing")
  );
}

function isTaglineIntent(text: string) {
  const t = text.toLowerCase();
  return t.includes("tagline") || t.includes("slogan");
}

function isTargetMarketIntent(text: string) {
  const t = text.toLowerCase();
  return t.includes("target market") || t.includes("audience") || t.includes("clients");
}

function isMissionIntent(text: string) {
  const t = text.toLowerCase();
  return t.includes("mission");
}

function isNichesIntent(text: string) {
  const t = text.toLowerCase();
  return t.includes("niches") || t.includes("specialize") || t.includes("industry");
}

function isAIContentIntent(text: string) {
  const t = text.toLowerCase();
  return t.includes("ai content") || t.includes("content marketing") || t.includes("repurposing");
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

function taglineAnswer() {
  return "Transitioning your business to the digital age.";
}

function targetMarketAnswer() {
  return `
Our ideal clients are forward-thinking businesses seeking digital transformation, including:

• Real Estate Developers & Agencies
• Travel and Tour Agencies
• E-commerce Brands
`.trim();
}

function missionAnswer() {
  return `
Our mission is to empower businesses to confidently navigate and dominate the digital future through AI-driven marketing, automation, and growth systems.
`.trim();
}

function nichesAnswer() {
  return `
Digital Transition Marketing specializes in:

• Real Estate Developers & Agencies — CGI ads and virtual tours
• Travel & Tour Agencies — AI-driven marketing & automation
• E-commerce Brands — scalable digital growth systems
`.trim();
}

function aiContentAnswer() {
  return `
AI-Optimized Content Creation & Repurposing includes:

• Strategic ideation & market research
• Drafting, SEO & voice search optimization
• Automated content repurposing across platforms
• Audience personalization & ROI maximization
`.trim();
}

/* ---------------- Persona Loader ---------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const personaPath = path.join(__dirname, "../personas/neon-vision.json");

let systemPersona: any = {
  name: BOT_NAME,
  tone: "professional, clear, helpful",
};

if (fs.existsSync(personaPath)) {
  try {
    systemPersona = JSON.parse(fs.readFileSync(personaPath, "utf-8"));
    console.log("✅ Persona loaded");
  } catch (err) {
    console.warn("⚠️ Persona JSON invalid, using fallback.");
  }
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

    /* ---------- STATIC INTENT ANSWERS ---------- */
    if (isServicesIntent(userMessage)) return await returnStatic(servicesAnswer(), userId);
    if (isTaglineIntent(userMessage)) return await returnStatic(taglineAnswer(), userId);
    if (isTargetMarketIntent(userMessage)) return await returnStatic(targetMarketAnswer(), userId);
    if (isMissionIntent(userMessage)) return await returnStatic(missionAnswer(), userId);
    if (isNichesIntent(userMessage)) return await returnStatic(nichesAnswer(), userId);
    if (isAIContentIntent(userMessage)) return await returnStatic(aiContentAnswer(), userId);

    /* ---------- KNOWLEDGE RETRIEVAL ---------- */
    const chunks = getTopChunks(userMessage, 6);
    const history = await memoryService.getHistory(userId);

    const knowledge =
      chunks.length > 0
        ? chunks.map((c: any) => c.text || "").join("\n\n")
        : "No direct knowledge match found.";

    const context = `
You are ${systemPersona.name}.
Respond clearly, professionally, and concisely.

CONVERSATION HISTORY:
${history.map((h: any) => `${h.role}: ${h.content}`).join("\n")}

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
      } catch (err) {
        console.warn("⚠️ Gemini failed:", err);
      }
    }

    if (isNonAnswer(response)) {
      response =
        "I can help with our services, AI systems, growth strategy, automation solutions, or booking a strategy call. What would you like to explore?";
    }

    response = enforceBotName(response);
    console.log(`[Hybrid] Model=${modelUsed}`);

    await memoryService.addMessage(userId, "assistant", response);
    return formatResponse(null, [{ content: response }], {});
  } catch (err) {
    console.error("Hybrid error FULL:", err);
    return `I’m experiencing a temporary processing issue, but I can still help with our services, CGI marketing, AI systems, or booking a call. What would you like to explore?`;
  }
}

/* ---------- Helper ---------- */

async function returnStatic(text: string, userId: string) {
  await memoryService.addMessage(userId, "assistant", text);
  return text;
}
