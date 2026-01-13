import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { getRelevantChunks } from "../db/vectorStore.js";
import { enforceBotName } from "../system/identity.js";
import { buildSynthPrompt } from "../system/synthPrompt.js";
import { cleanResponse } from "../utils/cleanResponse.js";

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

/* ---------------- Greeting detection ---------------- */
function isGreeting(prompt: string): boolean {
  const p = prompt.toLowerCase().trim();
  return ["hi", "hello", "hey", "yo", "sup", "how are you"].includes(p);
}

function isComplex(prompt: string): boolean {
  if (prompt.length > 300) return true;
  const lower = prompt.toLowerCase();
  return COMPLEX_KEYWORDS.some(word => lower.includes(word));
}

/* ---------------- Minimal local KB fallback ---------------- */
const LOCAL_KB = [
  "Digital Transition Marketing offers full-service digital marketing solutions.",
  "We specialize in social media marketing, AI tools, branding, SEO, and performance marketing.",
  "We help e-commerce, real estate, travel, and technology businesses grow online.",
  "Our AI assistant can provide business growth strategies and marketing insights instantly."
].join("\n");

export async function generateHybridResponse(prompt: string): Promise<string> {
  const cleanPrompt = prompt.trim();

  /* ---------------- Instant greetings ---------------- */
  if (isGreeting(cleanPrompt)) {
    return "Hello! I’m Neon Vision from Digital Transition Marketing. How can I help you today?";
  }

  /* ---------------- Build context ---------------- */
  let context = "";

  if (process.env.RENDER !== "true") {
    try {
      const embedding = await import("../system/identity.js").then(m => m.getPromptEmbedding(cleanPrompt));
      const chunks = await getRelevantChunks(embedding, 6);
      context = chunks.map(c => c.content).join("\n\n");
    } catch {
      // fallback silently
    }
  }

  /* ---------------- Use local KB if context empty ---------------- */
  if (!context) context = LOCAL_KB;

  const augmentedPrompt = buildSynthPrompt(context, cleanPrompt);
  let rawResponse = "";

  /* ---------------- Gemma for simple prompts ---------------- */
  try {
    if (!isComplex(cleanPrompt)) {
      rawResponse = await generateGemma(augmentedPrompt);
    }
  } catch {}

  /* ---------------- Gemini fallback ---------------- */
  if (!rawResponse || rawResponse.trim().length < 20) {
    rawResponse = await generateGemini(augmentedPrompt);
  }

  const cleaned = cleanResponse(rawResponse);
  return enforceBotName(cleaned, cleanPrompt);
}

export const hybridClient = generateHybridResponse;
