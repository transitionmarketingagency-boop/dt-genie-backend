// server/services/hybridRouter.ts
import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { getRelevantChunks } from "../db/vectorStore.js";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";

/* ---------------- ESM-safe __filename & __dirname ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ---------------- ESM-safe dynamic imports ---------------- */
const cleanResponseUrl = pathToFileURL(
  join(__dirname, "../utils/cleanResponse.js")
).href;

const identityUrl = pathToFileURL(
  join(__dirname, "../system/identity.js")
).href;

const { cleanResponse } = await import(cleanResponseUrl);
const { BOT_IDENTITY, enforceBotName } = await import(identityUrl);

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

/**
 * Determine if a prompt is complex
 */
function isComplex(prompt: string): boolean {
  if (prompt.length > 300) return true;
  const lower = prompt.toLowerCase();
  return COMPLEX_KEYWORDS.some(word => lower.includes(word));
}

/* ---------------- Hybrid response router ---------------- */
export async function generateHybridResponse(prompt: string): Promise<string> {
  const complex = isComplex(prompt);

  console.log(" M- Router decision:");
  console.log(" - complexity:", complex ? "COMPLEX" : "SIMPLE");
  console.log(" - prompt length:", prompt.length);

  let rawResponse = "";

  try {
    // ---------------- Inject context from similarity search ----------------
    // TS-safe cast ONLY (runtime logic unchanged)
    const contextChunks = await getRelevantChunks(prompt as any, 10);
    const context = contextChunks.map(c => c.content).join("\n\n");
    const augmentedPrompt = context ? `${context}\n\n${prompt}` : prompt;

    // ---------------- GEMMA for simple prompts ----------------
    if (!complex) {
      console.log(" - selected model: GEMMA (local)");
      const gemmaResponse = await generateGemma(augmentedPrompt);
      if (gemmaResponse && gemmaResponse.trim().length > 20) {
        rawResponse = gemmaResponse;
      }
    }
  } catch (err) {
    console.warn("⚠️ Gemma failed, falling back to Gemini:", err);
  }

  // ---------------- GEMINI for complex prompts or fallback ----------------
  if (!rawResponse) {
    console.log(" - selected model: GEMINI (cloud)");

    // TS-safe cast ONLY (runtime logic unchanged)
    const contextChunks = await getRelevantChunks(prompt as any, 10);
    const context = contextChunks.map(c => c.content).join("\n\n");
    const augmentedPrompt = context ? `${context}\n\n${prompt}` : prompt;

    rawResponse = await generateGemini(augmentedPrompt);
  }

  // ---------------- Clean & polish ----------------
  let polished = cleanResponse(rawResponse);

  // Lock bot name (single source of truth)
  polished = enforceBotName(polished);

  // Prefix with bot identity
  polished = `${BOT_IDENTITY}: ${polished}`;

  return polished;
}

/* ---------------- Backward compatibility ---------------- */
export const hybridClient = generateHybridResponse;
