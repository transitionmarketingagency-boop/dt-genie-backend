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

/* ================= BASIC INTENTS (MINIMAL ONLY) ================= */

function normalize(text: string) {
  return text.toLowerCase().trim();
}

function isGreeting(text: string) {
  const t = normalize(text);
  return t === "hi" || t === "hello" || t === "hey";
}

function isIdentityIntent(text: string) {
  const t = normalize(text);
  return (
    t.includes("who are you") ||
    t.includes("about yourself") ||
    t.includes("tell me about yourself")
  );
}

/* ================= NON-ANSWER CHECK ================= */

function isNonAnswer(text: string) {
  if (!text) return true;

  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (trimmed.length < 60) return true;

  if (
    lower.includes("as a large language model") ||
    lower.includes("as an ai language model") ||
    lower.includes("i don't have access") ||
    lower.includes("i am just an ai")
  ) return true;

  return false;
}

/* ================= RETRIEVAL ================= */

async function getEmbeddingKnowledge(userMessage: string) {
  try {
    const chunks = await getTopChunks(userMessage, 12, 0.30);

    if (!chunks || chunks.length === 0) return "";

    const MAX_CHARS = 14000;
    let total = 0;
    let combined = "";

    for (const c of chunks) {
      const text = c.text || "";
      if (total + text.length > MAX_CHARS) break;
      combined += text + "\n\n";
      total += text.length;
    }

    console.log("🔎 Knowledge length:", combined.length);
    return combined.trim();
  } catch (err) {
    console.warn("⚠️ Retrieval failed:", err);
    return "";
  }
}

/* ================= MAIN RESPONSE ================= */

export async function generateHybridResponse(
  userMessage: string,
  userId = "default-session"
): Promise<string> {
  try {
    await memoryService.addMessage(userId, "user", userMessage);

    /* ===== SAFE DIRECT ROUTES ===== */

    if (isGreeting(userMessage)) {
      const reply = `I’m ${BOT_NAME}, the AI operating system behind Digital Transition Marketing. How can I assist you today?`;
      await memoryService.addMessage(userId, "assistant", reply);
      return reply;
    }

    if (isIdentityIntent(userMessage)) {
      const reply = `I am ${BOT_NAME}, the strategic AI system representing Digital Transition Marketing. I guide businesses through AI-driven marketing, automation, performance advertising, and scalable digital growth systems.`;
      await memoryService.addMessage(userId, "assistant", reply);
      return reply;
    }

    /* ===== EMBEDDING KNOWLEDGE ===== */

    let embeddingKnowledge = await getEmbeddingKnowledge(userMessage);

    // If retrieval weak, inject brand anchor query
    if (!embeddingKnowledge || embeddingKnowledge.length < 300) {
      const fallbackKnowledge = await getEmbeddingKnowledge(
        "Digital Transition Marketing overview services AI SEO automation performance advertising"
      );
      embeddingKnowledge += "\n\n" + fallbackKnowledge;
    }

    const history = await memoryService.getHistory(userId);
    const shortHistory =
      history.slice(-6).map(h => h.content).join("\n") || "None";

    const prompt = `
You are ${BOT_NAME}, the official AI system of Digital Transition Marketing.

You represent the company directly.
You are not a generic AI assistant.
Never say you are an AI model.

CORE RULES:
- Base your response primarily on COMPANY KNOWLEDGE.
- If knowledge is partial, reason strategically using brand context.
- Do NOT fabricate services.
- Do NOT default to booking links unless explicitly requested.
- Provide structured, expert-level responses.
- Use headings and bullet points when appropriate.
- Speak confidently and strategically.

COMPANY KNOWLEDGE:
${embeddingKnowledge || "Use structured brand logic based on Digital Transition Marketing's known services."}

RECENT CONTEXT:
${shortHistory}

USER QUESTION:
${userMessage}

Provide a detailed, strategic, well-structured answer.
`;

    /* ===== MODEL EXECUTION ===== */

    let response = cleanResponse(await generateGemma(prompt));
    let modelUsed = "Gemma";

    if (isNonAnswer(response) && canUseGemini()) {
      try {
        const geminiResponse = await generateGemini(prompt);
        response = cleanResponse(geminiResponse);
        markGeminiUsed();
        modelUsed = "Gemini";
      } catch (err) {
        console.warn("⚠️ Gemini fallback failed:", err);
      }
    }

    if (isNonAnswer(response)) {
      response = cleanResponse(
        await generateGemma(
          prompt +
            "\n\nExpand deeply. Provide more strategic detail. Structure clearly with headings."
        )
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
