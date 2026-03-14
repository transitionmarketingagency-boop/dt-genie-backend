// server/services/strategicBrain.ts
import { getRelevantIntents } from "./intentManager.js";
import { getFusedChunks } from "./intentVectorFusion.js";
import { memoryService } from "./memoryService.js";
import { leadQualifier } from "./leadQualifier.js";
import { reasoningEngine } from "./reasoningEngine.js";

/* ================= TYPES ================= */
export type BrainContext = {
  message: string;
  intent?: string;
  stage: "greeting" | "discovery" | "strategy" | "service" | "conversion";
  leadScore: number;
  reasoning?: string;
  recentContext?: { role: string; content: string }[];
  strategicMemory?: any;
};

/* ================= GREETING DETECTOR ================= */
function isGreeting(text: string) {
  const greetings = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"];
  const lower = text.toLowerCase();
  return greetings.some((g) => lower === g || lower.startsWith(g + " "));
}

/* ================= CONVERSATION STAGE ================= */
function detectStage(message: string): BrainContext["stage"] {
  const text = message.toLowerCase();

  if (isGreeting(text)) return "greeting";
  if (text.includes("how") || text.includes("strategy") || text.includes("grow")) return "strategy";
  if (text.includes("service") || text.includes("price") || text.includes("cost")) return "service";
  if (text.includes("hire") || text.includes("work with") || text.includes("book")) return "conversion";
  return "discovery";
}

/* ================= LEAD SCORE ================= */
function scoreLead(message: string) {
  let score = 0;
  const text = message.toLowerCase();

  if (text.includes("business")) score += 1;
  if (text.includes("company")) score += 1;
  if (text.includes("brand")) score += 1;
  if (text.includes("hire")) score += 2;
  if (text.includes("agency")) score += 1;
  if (text.includes("marketing")) score += 1;

  return Math.min(score, 5);
}

/* ================= MAIN STRATEGIC BRAIN ================= */
export async function strategicBrain(userMessage: string, sessionId?: string) {
  // ----- Intents -----
  const intents = getRelevantIntents(userMessage, 1);
  const primaryIntent = intents.length > 0 ? intents[0].intent.name : "general";

  // ----- Stage -----
  const stage = detectStage(userMessage);

  // ----- Lead Score -----
  let leadScore = scoreLead(userMessage);
  if (sessionId) {
    // Update dynamic BANT-based lead score in memory
    leadQualifier.scoreLead(sessionId, { need: leadScore / 5 });
  }

  // ----- Reasoning -----
  let reasoning = generateReasoning(userMessage);
  if (sessionId) {
    const reasoningData = await reasoningEngine.analyze(sessionId, userMessage);
    reasoning = reasoningData.strategy || reasoning;
  }

  // ----- Chunks -----
  const chunks = await getFusedChunks(userMessage, 5);

  // ----- Recent Context -----
  const recentContext = sessionId ? await memoryService.getRecentContext(sessionId) : [];

  // ----- Strategic Memory -----
  const strategicMemory = sessionId ? await memoryService.getStrategicMemory(sessionId) : {};

  // ----- Brain Context -----
  const brainContext: BrainContext = {
    message: userMessage,
    intent: primaryIntent,
    stage,
    leadScore,
    reasoning,
    recentContext: recentContext.map((m) => ({ role: m.role, content: m.content })),
    strategicMemory,
  };

  return {
    brainContext,
    chunks,
  };
}

/* ================= REASONING (Fallback) ================= */
function generateReasoning(message: string) {
  const text = message.toLowerCase();
  if (text.includes("grow")) return "User wants business growth strategy";
  if (text.includes("ads")) return "User is interested in advertising solutions";
  if (text.includes("seo")) return "User is exploring search optimization";
  return "General marketing inquiry";
}
