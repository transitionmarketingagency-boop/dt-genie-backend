// server/services/hybridClient.ts
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js"; // memory persistence

/* ---------------- ESM-safe paths ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- Load .env ---------------- */
dotenv.config({ path: path.join(__dirname, "../.env") });

/* ---------------- Gemini circuit breaker ---------------- */
let geminiDisabledUntil = 0;
const GEMINI_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

function isGeminiAvailable(): boolean {
  return Date.now() > geminiDisabledUntil;
}

function disableGemini(reason: string) {
  geminiDisabledUntil = Date.now() + GEMINI_COOLDOWN_MS;
  console.warn(`⚠️ Gemini disabled for 10 minutes (${reason})`);
}

/* ---------------- Strict complexity detection ---------------- */
const COMPLEX_KEYWORDS = [
  "strategy",
  "plan",
  "analyze",
  "analysis",
  "funnel",
  "campaign",
  "roadmap",
  "growth",
  "automation",
  "architecture",
  "system",
  "scaling",
  "integration",
  "workflow",
];

function isComplexQuery(prompt: string): boolean {
  const text = prompt.toLowerCase();
  if (text.length > 250) return true;
  return COMPLEX_KEYWORDS.some((word) => text.includes(word));
}

/* ---------------- Hybrid response ---------------- */
export async function generateHybridResponse(
  prompt: string,
  sessionId: string
): Promise<string> {
  const cleanPrompt = prompt.trim();
  let reply = "";

  /* ======================================================
     1️⃣ ALWAYS TRY GEMMA FIRST
     ====================================================== */
  try {
    reply = await generateGemma(cleanPrompt);
    if (reply && reply.trim().length > 0) {
      await memoryService.addMessage(sessionId, "assistant", reply);
      return reply;
    }
  } catch (err) {
    console.warn("⚠️ Gemma failed:", err);
  }

  /* ======================================================
     2️⃣ GEMINI ONLY FOR COMPLEX QUERIES
     ====================================================== */
  if (isComplexQuery(cleanPrompt) && isGeminiAvailable()) {
    try {
      reply = await generateGemini(cleanPrompt);
      if (reply && reply.trim().length > 0) {
        await memoryService.addMessage(sessionId, "assistant", reply);
        return reply;
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
        disableGemini("quota exceeded");
        console.warn("Gemini quota exceeded — continuing with Gemma-only response.");
      } else {
        console.warn("⚠️ Gemini error:", msg);
      }
    }
  }

  /* ======================================================
     3️⃣ SAFE FINAL FALLBACK
     ====================================================== */
  reply =
    "Sure — you can book a call with our team here:\n" +
    "https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future";
  await memoryService.addMessage(sessionId, "assistant", reply);

  return reply;
}

/* ---------------- Backward compatibility ---------------- */
export const hybridClient = generateHybridResponse;
