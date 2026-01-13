import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { getRelevantChunks } from "../db/vectorStore.js";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";

/* ---------------- ESM-safe __filename & __dirname ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ---------------- Dynamic imports ---------------- */
const { cleanResponse } = await import(
  pathToFileURL(join(__dirname, "../utils/cleanResponse.js")).href
);
const { enforceBotName } = await import(
  pathToFileURL(join(__dirname, "../system/identity.js")).href
);

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
export async function generateHybridResponse(prompt: string): Promise<string> {
  let rawResponse = "";

  try {
    /* ---- Similarity search context ---- */
    const contextChunks = await getRelevantChunks(prompt as any, 8);
    const context = contextChunks.map(c => c.content).join("\n\n");
    const augmentedPrompt = context
      ? `${context}\n\nUser question:\n${prompt}`
      : prompt;

    /* ---- Gemma for simple queries ---- */
    if (!isComplex(prompt)) {
      rawResponse = await generateGemma(augmentedPrompt);
    }
  } catch {
    // Silent fallback
  }

  /* ---- Gemini fallback ---- */
  if (!rawResponse || rawResponse.trim().length < 20) {
    const contextChunks = await getRelevantChunks(prompt as any, 8);
    const context = contextChunks.map(c => c.content).join("\n\n");
    const augmentedPrompt = context
      ? `${context}\n\nUser question:\n${prompt}`
      : prompt;

    rawResponse = await generateGemini(augmentedPrompt);
  }

  /* ---- Clean + enforce naming rules ---- */
  const cleaned = cleanResponse(rawResponse);
  return enforceBotName(cleaned, prompt);
}

/* ---------------- Backward compatibility ---------------- */
export const hybridClient = generateHybridResponse;
