// server/services/hybridRouter.ts

import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { getRelevantChunks, getAllKBChunks } from "../db/vectorStore.js";
import { buildSynthPrompt } from "../system/synthPrompt.js";
import { cleanResponse, enforceBotName } from "../utils/cleanResponse.js";

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
  return COMPLEX_KEYWORDS.some(word => lower.includes(word));
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

  /* ---------------- Local KB similarity search ---------------- */
  try {
    const allChunks = await getAllKBChunks(); // Get all persona, sales, marketing, training KB
    const relevant = getRelevantChunks(prompt, 6, allChunks); // Node.js similarity search
    context = relevant.map(c => c.content).join("\n\n");
  } catch (err) {
    console.warn("⚠️ KB similarity search failed:", err?.message);
  }

  /* ---------------- Build final prompt ---------------- */
  const augmentedPrompt = buildSynthPrompt(context, prompt);

  let rawResponse = "";

  /* ---------------- Gemma for simple queries ---------------- */
  try {
    if (!isComplex(prompt)) {
      rawResponse = await generateGemma(augmentedPrompt);
    }
  } catch (err) {
    console.warn("⚠️ Gemma failed:", err?.message);
  }

  /* ---------------- Gemini fallback ---------------- */
  if (!rawResponse || rawResponse.trim().length < 20) {
    try {
      rawResponse = await generateGemini(augmentedPrompt);
    } catch (err) {
      console.error("❌ Gemini failed:", err?.message);
      rawResponse = "I’m having trouble processing that right now. Can you rephrase?";
    }
  }

  /* ---------------- Clean + enforce Neon Vision identity ---------------- */
  const cleaned = cleanResponse(rawResponse);
  return enforceBotName(cleaned, prompt);
}

/* ---------------- Backward compatibility ---------------- */
export const hybridClient = generateHybridResponse;
