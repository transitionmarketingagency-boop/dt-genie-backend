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
  } catch {
    console.warn("⚠️ Persona JSON invalid, using fallback.");
  }
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
  ) {
    return true;
  }

  return false;
}

/* ================= MAIN RESPONSE ================= */

export async function generateHybridResponse(
  userMessage: string,
  userId = "default-session"
): Promise<string> {
  try {
    await memoryService.addMessage(userId, "user", userMessage);

    if (isGreeting(userMessage)) {
      const r = `I’m ${BOT_NAME}, the AI operating system behind Digital Transition Marketing. How can I assist you today?`;
      await memoryService.addMessage(userId, "assistant", r);
      return r;
    }

    if (isServiceCountIntent(userMessage))
      return await returnStatic(serviceCountAnswer(), userId);

    if (isTaglineIntent(userMessage))
      return await returnStatic(taglineAnswer(), userId);

    if (isTargetMarketIntent(userMessage))
      return await returnStatic(targetMarketAnswer(), userId);

    if (isMissionIntent(userMessage))
      return await returnStatic(missionAnswer(), userId);

    if (isNichesIntent(userMessage))
      return await returnStatic(nichesAnswer(), userId);

    /* ===== FIXED: Await embedding-based retrieval ===== */

    let chunks: any[] = [];
    try {
      chunks = await getTopChunks(userMessage, 3);
    } catch (err) {
      console.warn("⚠️ Retrieval failed, continuing without knowledge.");
    }

    const knowledge =
      chunks && chunks.length > 0
        ? chunks.map((c: any) => c.text || "").join("\n\n")
        : "";

    const history = await memoryService.getHistory(userId);

    const shortHistory =
      history.slice(-4).map((h: any) => h.content).join("\n") || "None";

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

    let response = cleanResponse(await generateGemma(prompt));
    let modelUsed = "Gemma";

    if (isNonAnswer(response) && canUseGemini()) {
      try {
        const geminiResponse = await generateGemini(prompt);
        response = cleanResponse(geminiResponse);
        markGeminiUsed();
        modelUsed = "Gemini";
      } catch {
        console.warn("⚠️ Gemini fallback failed.");
      }
    }

    if (isNonAnswer(response)) {
      response = cleanResponse(
        await generateGemma(prompt + "\n\nBe more detailed and specific.")
      );
      modelUsed = "Gemma-Retry";
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
