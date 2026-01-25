// server/services/hybridRouter.ts

import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { fetchRelevantChunks } from "../queryChunksWrapper.js"; // Python embeddings
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

/* ---------------- Confidence check ---------------- */
function isLowConfidence(response: string): boolean {
  if (!response || response.trim().length < 80) return true;
  const patterns = [/no information/i, /not available/i, /cannot answer/i];
  return patterns.some((p) => p.test(response));
}

/* ---------------- Hybrid response router ---------------- */
export async function generateHybridResponse(prompt: string): Promise<string> {
  // ⚡ Instant greeting
  if (isGreeting(prompt)) {
    return "Hello! I’m Neon Vision from Digital Transition Marketing. How can I help you today?";
  }

  let context = "";
  let chunks: any[] = [];

  // ---------------- Retrieve relevant knowledge (Python embeddings + vector DB)
  try {
    chunks = await fetchRelevantChunks(prompt, 6); // top 6 KB matches
    context = chunks.map((c) => c.source).join("\n\n");

    console.log(
      "Top 3 chunks for query:",
      chunks.slice(0, 3).map((c) => c.source.slice(0, 80))
    );
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.warn("⚠️ Knowledge retrieval failed:", err.message);
    } else {
      console.warn("⚠️ Knowledge retrieval failed:", err);
    }
  }

  const augmentedPrompt = buildSynthPrompt(context, prompt);

  let rawResponse = "";
  let modelUsed = "";

  // ---------------- Gemma for simple queries
  try {
    if (!isComplex(prompt)) {
      rawResponse = await generateGemma(augmentedPrompt);
      modelUsed = "Gemma";
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.warn("⚠️ Gemma API failed, fallback to Gemini:", err.message);
    } else {
      console.warn("⚠️ Gemma API failed, fallback to Gemini:", err);
    }
  }

  // ---------------- Gemini for complex queries or fallback
  if (!rawResponse || isLowConfidence(rawResponse) || isComplex(prompt)) {
    try {
      rawResponse = await generateGemini(augmentedPrompt);
      modelUsed = "Gemini";
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.warn("❌ Gemini API failed:", err.message);
      } else {
        console.warn("❌ Gemini API failed:", err);
      }
      rawResponse = rawResponse || "I’m having trouble processing that right now. Please try again.";
      modelUsed = modelUsed || "Fallback";
    }
  }

  // ---------------- Clean + enforce identity ----------------
  const cleaned = cleanResponse(rawResponse);
  const finalResponse = enforceBotName(cleaned);

  console.log(
    `[${new Date().toISOString()}][Hybrid] Model: ${modelUsed} | Response length: ${finalResponse.length}`
  );

  return finalResponse;
}

/* ---------------- Backward compatibility ---------------- */
export const hybridClient = generateHybridResponse;
