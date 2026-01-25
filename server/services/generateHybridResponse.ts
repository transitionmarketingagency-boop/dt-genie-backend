import { fetchRelevantChunks } from "../queryChunksWrapper.js";
import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { formatResponse } from "../utils/formatResponse.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/* ================= GEMINI QUOTA MANAGER ================= */

const GEMINI_DAILY_LIMIT = 20;

let geminiUsage = {
  count: 0,
  lastReset: Date.now()
};

function resetIfNeeded() {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  if (now - geminiUsage.lastReset > ONE_DAY) {
    geminiUsage.count = 0;
    geminiUsage.lastReset = now;
    console.log("♻️ Gemini quota reset");
  }
}

function canUseGemini(): boolean {
  resetIfNeeded();
  return geminiUsage.count < GEMINI_DAILY_LIMIT;
}

function markGeminiUsed() {
  geminiUsage.count++;
}

/* ---------------- ESM-safe __dirname ---------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- Persona loader ---------------- */

const personaPath = path.join(__dirname, "../personas/neon-vision.json");

let systemPersona: any = {
  name: BOT_NAME,
  tone: "professional, clear, helpful",
  rules: [
    "Answer only using company knowledge",
    "Do not exaggerate or invent services",
    "Be concise and structured",
    "Sound calm and premium, not promotional"
  ]
};

try {
  if (fs.existsSync(personaPath)) {
    systemPersona = JSON.parse(fs.readFileSync(personaPath, "utf-8"));
    console.log("✅ Persona loaded");
  }
} catch {
  console.warn("⚠️ Persona fallback active");
}

/* ---------------- Complexity detector ---------------- */

function isComplexQuery(message: string): boolean {
  const t = message.toLowerCase();
  return (
    t.length > 120 ||
    /strategy|architecture|predictive|analytics|ai model|workflow|pipeline|integration|automation/.test(t)
  );
}

/* ---------------- Memory formatter ---------------- */

function formatMemory(history: any[]) {
  if (!history?.length) return "";
  return history
    .slice(-6)
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
}

function buildPersonaInstructions(persona: any) {
  return `
You are ${persona.name}.
Tone: ${persona.tone}.
Rules:
${persona.rules.map((r: string) => `- ${r}`).join("\n")}
`;
}

/* ---------------- Context builder ---------------- */

async function buildDeepContext(userId: string, userMessage: string) {
  const relevantChunks = await fetchRelevantChunks(userMessage, 8);
  const history = await memoryService.getHistory(userId);

  const knowledgeText = relevantChunks
    .map(c => c.source)
    .filter(Boolean)
    .join("\n\n");

  return {
    hasKnowledge: Boolean(knowledgeText.trim()),
    context: `
${buildPersonaInstructions(systemPersona)}

CONVERSATION HISTORY:
${formatMemory(history)}

COMPANY KNOWLEDGE:
${knowledgeText}

USER QUESTION:
${userMessage}
`
  };
}

/* ---------------- Answer quality detector ---------------- */

function isNonAnswer(text: string) {
  return (
    !text ||
    text.trim().length < 120 ||
    /^here’s what i found/i.test(text) ||
    /clarify your request/i.test(text)
  );
}

/* ================= MAIN HYBRID RESPONSE ================= */

export async function generateHybridResponse(
  userMessage: string,
  userId = "default-session"
): Promise<string> {
  try {
    await memoryService.addMessage(userId, "user", userMessage);

    const { context, hasKnowledge } =
      await buildDeepContext(userId, userMessage);

    const complex = isComplexQuery(userMessage);

    /* ---------- GEMMA ALWAYS FIRST ---------- */

    let response = cleanResponse(await generateGemma(context));
    let modelUsed = "Gemma";

    /* ---------- GEMINI (COMPLEX + QUOTA) ---------- */

    if (
      complex &&
      isNonAnswer(response) &&
      hasKnowledge &&
      canUseGemini()
    ) {
      try {
        response = cleanResponse(await generateGemini(context));
        markGeminiUsed();
        modelUsed = "Gemini";
      } catch {
        console.warn("❌ Gemini error — skipping Gemini for now");
      }
    }

    /* ---------- FINAL GUARANTEE ---------- */

    if (isNonAnswer(response)) {
      response = hasKnowledge
        ? "Based on our internal knowledge, we provide end-to-end digital marketing services, AI-driven analytics, CGI virtual tours, performance advertising, SEO, automation, and scalable growth strategies for modern businesses."
        : "I don’t currently have enough confirmed information to answer that accurately.";
    }

    response = enforceBotName(response);

    console.log(
      `[${new Date().toISOString()}][Hybrid] Model: ${modelUsed} | GeminiUsed: ${geminiUsage.count}/${GEMINI_DAILY_LIMIT} | Length: ${response.length}`
    );

    await memoryService.addMessage(userId, "assistant", response);

    return formatResponse(null, [{ content: response }], {});
  } catch (err) {
    console.error("Hybrid response error:", err);
    return `Sorry — ${BOT_NAME} is temporarily unavailable.`;
  }
}
