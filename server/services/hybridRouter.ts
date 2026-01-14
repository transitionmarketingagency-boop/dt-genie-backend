// server/services/hybridRouter.ts

import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { getAllKBChunks } from "../db/vectorStore.js";
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

/* ---------------- Prompt classification ---------------- */
function isComplex(prompt: string): boolean {
  if (prompt.length > 300) return true;
  const lower = prompt.toLowerCase();
  return COMPLEX_KEYWORDS.some((word) => lower.includes(word));
}

function isGreeting(prompt: string): boolean {
  return /^(hi|hello|hey|yo|sup|how are you)$/i.test(prompt.trim());
}

/* ---------------- JS-based similarity (cosine) ---------------- */
function cosineSim(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * (b[i] || 0), 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

/* ---------------- Top-N similarity search ---------------- */
function topChunks(
  embedding: number[],
  chunks: { content: string; vector: number[] }[],
  topN = 6
) {
  const scored = chunks
    .map((c) => ({ ...c, score: cosineSim(embedding, c.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
  return scored;
}

/* ---------------- Hybrid response router ---------------- */
export async function generateHybridResponse(
  prompt: string
): Promise<string> {
  // ⚡ Instant greeting
  if (isGreeting(prompt)) {
    return "Hello! I’m Neon Vision from Digital Transition Marketing. How can I help you today?";
  }

  let context = "";

  /* ---------------- Load KB chunks and select top matches ---------------- */
  try {
    const allChunks = await getAllKBChunks(); // includes persona, sales, marketing, training

    // Use JS-based text embedding fallback (replace with real vectors if available)
    const promptVector = Array.from(prompt)
      .map((c) => c.charCodeAt(0))
      .slice(0, 1536);

    const relevantChunks = topChunks(promptVector, allChunks, 6);
    context = relevantChunks.map((c) => c.content).join("\n\n");
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

  /* ---------------- Gemini for complex queries OR fallback ---------------- */
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
