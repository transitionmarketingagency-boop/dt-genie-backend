import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { getRelevantChunks } from "../db/vectorStore.js";
import { getPromptEmbedding } from "../system/identity.js";
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

function isGreeting(prompt: string): boolean {
  return /^(hi|hello|hey|how are you|good morning|good evening)$/i.test(
    prompt.trim()
  );
}

/* ---------------- Hybrid response router ---------------- */
export async function generateHybridResponse(prompt: string): Promise<string> {
  // ⚡ Instant response for greetings
  if (isGreeting(prompt)) {
    return "Hello! How can I help you today?";
  }

  let rawResponse = "";

  /* ---------------- Embed ONCE ---------------- */
  let context = "";
  try {
    const embedding = await getPromptEmbedding(prompt);
    const chunks = await getRelevantChunks(embedding, 6);
    context = chunks.map(c => c.content).join("\n\n");
  } catch {
    // context is optional
  }

  const augmentedPrompt = context
    ? `${context}\n\nUser question:\n${prompt}`
    : prompt;

  /* ---------------- Try Gemma for simple ---------------- */
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

  /* ---------------- Clean & enforce naming ---------------- */
  const cleaned = cleanResponse(rawResponse);
  return enforceBotName(cleaned, prompt);
}

/* ---------------- Backward compatibility ---------------- */
export const hybridClient = generateHybridResponse;
