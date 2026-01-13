// server/services/hybridRouter.ts

import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { getRelevantChunks } from "../db/vectorStore.js";
import { getPromptEmbedding, enforceBotName } from "../system/identity.js";
import { buildSynthPrompt } from "../system/synthPrompt.js";
import { cleanResponse } from "../utils/cleanResponse.js";

/* ---------------- Prompt helpers ---------------- */
function normalizePrompt(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\n\r\t]/g, "")
    .trim();
}

function isGreeting(prompt: string): boolean {
  const p = normalizePrompt(prompt);
  return (
    p === "hi" ||
    p === "hello" ||
    p === "hey" ||
    p === "yo" ||
    p === "sup" ||
    p === "how are you"
  );
}

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

/* ---------------- Hybrid response router ---------------- */
export async function generateHybridResponse(
  prompt: string
): Promise<string> {
  const cleanPrompt = normalizePrompt(prompt);

  /* ⚡ Instant greeting — NO DB, NO Python, NO LLM */
  if (isGreeting(cleanPrompt)) {
    return "Hello! I’m Neon Vision, the AI strategist for Digital Transition Marketing. How can I help you today?";
  }

  let context = "";

  /* ---------------- Similarity search (SAFE + FAST) ---------------- */
  /**
   * Python embeddings are TOO slow on Render.
   * We ONLY run them locally or when explicitly allowed.
   */
  if (process.env.RENDER !== "true") {
    try {
      const embedding = await getPromptEmbedding(prompt);
      const chunks = await getRelevantChunks(embedding, 6);
      context = chunks.map(c => c.content).join("\n\n");
    } catch {
      // Context is optional
    }
  }

  /* ---------------- Build system-aware prompt ---------------- */
  const augmentedPrompt = buildSynthPrompt(context, prompt);

  let rawResponse = "";

  /* ---------------- GEMMA for simple prompts ---------------- */
  try {
    if (!isComplex(prompt)) {
      rawResponse = await generateGemma(augmentedPrompt);
    }
  } catch {
    // silent fallback
  }

  /* ---------------- GEMINI fallback ---------------- */
  if (!rawResponse || rawResponse.trim().length < 20) {
    rawResponse = await generateGemini(augmentedPrompt);
  }

  /* ---------------- Clean & enforce identity ---------------- */
  const cleaned = cleanResponse(rawResponse);
  return enforceBotName(cleaned, prompt);
}

/* ---------------- Backward compatibility ---------------- */
export const hybridClient = generateHybridResponse;
