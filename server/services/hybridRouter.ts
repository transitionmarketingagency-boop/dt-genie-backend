// server/services/hybridRouter.ts

import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { getRelevantChunks } from "../db/vectorStore.js";
import { getPromptEmbedding } from "../system/identity.js";
import { buildSynthPrompt } from "../system/synthPrompt.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { enforceBotName } from "../system/identity.js";

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

function isComplex(prompt: string): boolean {
  if (prompt.length > 300) return true;
  const lower = prompt.toLowerCase();
  return COMPLEX_KEYWORDS.some(word => lower.includes(word));
}

function isGreeting(prompt: string): boolean {
  return /^(hi|hello|hey|yo|sup|how are you)$/i.test(prompt.trim());
}

/* ---------------- Hybrid response router ---------------- */
export async function generateHybridResponse(
  prompt: string
): Promise<string> {
  /* ⚡ Instant greeting response (NO DB / NO LLM) */
  if (isGreeting(prompt)) {
    return "Hello! I’m Neon Vision from Digital Transition Marketing. How can I help you today?";
  }

  let context = "";

  /* ---------------- Similarity search (EMBED ONCE) ---------------- */
  try {
    const embedding = await getPromptEmbedding(prompt);
    const chunks = await getRelevantChunks(embedding, 6);
    context = chunks.map(c => c.content).join("\n\n");
  } catch {
    // Context is optional – fail silently
  }

  /* ---------------- Build final system-aware prompt ---------------- */
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

  /* ---------------- Gemini fallback ---------------- */
  if (!rawResponse || rawResponse.trim().length < 20) {
    rawResponse = await generateGemini(augmentedPrompt);
  }

  /* ---------------- Clean & enforce identity rules ---------------- */
  const cleaned = cleanResponse(rawResponse);
  return enforceBotName(cleaned, prompt);
}

/* ---------------- Backward compatibility ---------------- */
export const hybridClient = generateHybridResponse;
