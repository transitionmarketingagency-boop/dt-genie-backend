// server/services/hybridRouter.ts

import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { getRelevantChunks } from "../db/vectorStore.js";
import { buildSynthPrompt } from "../system/synthPrompt.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { enforceBotName, getPromptEmbedding } from "../system/identity.js";

/* ---------------- Keywords for complex prompts ---------------- */
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
];

/* ---------------- Prompt classification ---------------- */
function isComplex(prompt: string): boolean {
  if (prompt.length > 300) return true;
  const lower = prompt.toLowerCase();
  return COMPLEX_KEYWORDS.some((word) => lower.includes(word));
}

function isGreeting(prompt: string): boolean {
  return /^(hi|hello|hey|yo|sup|how are you)$/i.test(prompt.trim());
}

/* ---------------- Hybrid response router ---------------- */
export async function generateHybridResponse(prompt: string): Promise<string> {
  // ⚡ Instant greeting
  if (isGreeting(prompt)) {
    return "Hello! I’m Neon Vision from Digital Transition Marketing. How can I help you today?";
  }

  let context = "";

  /* ---------------- Compute real prompt embedding ---------------- */
  try {
    const promptEmbedding = await getPromptEmbedding(prompt); // ← real embedding via Python
    const chunks = await getRelevantChunks(promptEmbedding, 6); // top 6 KB matches
    context = chunks.map((c) => c.content).join("\n\n");
  } catch (err: any) {
    console.warn("⚠️ KB similarity search failed:", err?.message || err);
  }

  /* ---------------- Build final prompt ---------------- */
  const augmentedPrompt = buildSynthPrompt(context, prompt);

  let rawResponse = "";

  /* ---------------- Gemma for simple queries ---------------- */
  try {
    if (!isComplex(prompt)) {
      rawResponse = await generateGemma(augmentedPrompt);
    }
  } catch {
    // silent fallback
  }

  /* ---------------- Gemini for complex queries or fallback ---------------- */
  if (!rawResponse || rawResponse.trim().length < 20 || isComplex(prompt)) {
    try {
      rawResponse = await generateGemini(augmentedPrompt);
    } catch {
      rawResponse =
        "I’m having trouble processing that right now. Please try again.";
    }
  }

  /* ---------------- Clean + enforce Neon Vision identity ---------------- */
  const cleaned = cleanResponse(rawResponse);
  return enforceBotName(cleaned, prompt);
}

/* ---------------- Backward compatibility ---------------- */
export const hybridClient = generateHybridResponse;
