// server/services/strategicBrain.ts

import { getRelevantIntents } from "./intentManager.js";
import { getFusedChunks } from "./intentVectorFusion.js";
import { memoryService } from "./memoryService.js";
import { leadQualifier } from "./leadQualifier.js";
import { reasoningEngine } from "./reasoningEngine.js";
import { detectIntents } from "./serviceDetector.js";

/* ================= TYPES ================= */
export type StrategicMemory = {
  servicesDiscussed?: string[];
  businessMentioned?: boolean;
  greetingIndex?: number;
  industry?: string;
  lastUserProblem?: string;
  lastService?: string;
  businessType?: string;
};

export type BrainContext = {
  message: string;
  intent?: string;
  stage: "greeting" | "discovery" | "strategy" | "service" | "conversion";
  leadScore: number;
  dealProbability?: number;
  recommendedService?: string | null;
  triggerBooking?: boolean;
  reasoning?: string;
  recentContext?: { role: string; content: string }[];
  strategicMemory?: StrategicMemory;
  detectedServices?: string[];
  dynamicGreeting?: string;
  unifiedIntentRanking?: { intent: string; score: number }[];
  executionMode?: "execution" | "exploration" | "action";
  highIntent?: boolean;
  hasSufficientContext?: boolean;
};

/* ================= HELPERS ================= */
function normalizeText(text: string) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGreeting(text: string) {
  return /^(hi|hello|hey)\b/i.test(text);
}

function detectStage(message: string, leadScore: number): BrainContext["stage"] {
  if (isGreeting(message) && leadScore < 0.5) return "greeting";
  if (/(hire|book|schedule|call|start|work with)/i.test(message)) return "conversion";
  if (/(price|cost|services|package)/i.test(message)) return "service";
  if (/(how|improve|optimize|strategy|fix)/i.test(message)) return "strategy";
  return "discovery";
}

function estimateDealProbability(stage: BrainContext["stage"], leadScore: number) {
  const base = {
    greeting: 0.1,
    discovery: 0.3,
    strategy: 0.5,
    service: 0.75,
    conversion: 0.9,
  };
  return Math.min(base[stage] + leadScore * 0.04, 0.98);
}

function isHighIntent(message: string, stage: BrainContext["stage"], leadScore: number) {
  return /(hire|book|schedule|start now|ready)/i.test(message) || stage === "conversion" || leadScore >= 7;
}

/* ================= MAIN ================= */
export async function strategicBrain(userMessage: string, sessionId?: string) {
  const message = normalizeText(userMessage);

  const strategicMemory: StrategicMemory = sessionId
    ? await memoryService.getStrategicMemory(sessionId).catch(() => ({}))
    : {};

  /* ---------- LEAD SCORE ---------- */
  let leadScore = 0;
  if (sessionId) {
    try {
      const result = leadQualifier.scoreLead(sessionId, { need: 0.5 });
      leadScore = Math.min(result.total * 10, 10);
    } catch {}
  }

  /* ---------- STAGE ---------- */
  let stage = detectStage(message, leadScore);
  let executionMode: BrainContext["executionMode"] =
    stage === "greeting" ? "exploration" : "execution";

  /* ---------- INTENTS ---------- */
  let unifiedIntentRanking: { intent: string; score: number }[] = [];
  let primaryIntent = "general";

  try {
    const intents = getRelevantIntents(message, [], 5);
    unifiedIntentRanking = intents.map((i) => ({ intent: i.intent.name, score: i.score }));
    if (intents.length) primaryIntent = intents[0].intent.name;
  } catch {}

  /* ---------- SERVICES ---------- */
  let detectedServices: string[] = [];
  try {
    const detected = await detectIntents(message);
    detectedServices = detected
      .filter((i) => i.type === "service" && i.confidence > 0.5)
      .map((i) => i.value);

    // Merge with previous memory
    const existing = new Set(strategicMemory.servicesDiscussed || []);
    detectedServices.forEach((s) => existing.add(s));
    strategicMemory.servicesDiscussed = Array.from(existing);

    strategicMemory.lastService = detectedServices[0] || strategicMemory.lastService;
  } catch {}

  /* ---------- CONTEXT ---------- */
  const hasBusinessContext =
    /(roas|ads|sales|conversion|seo|revenue|store|business)/i.test(message);
  const hasSufficientContext =
    message.length > 8 || (strategicMemory.servicesDiscussed?.length ?? 0) > 0;

  if (hasBusinessContext) {
    strategicMemory.businessMentioned = true;
    strategicMemory.lastUserProblem = message;
  }

  /* ---------- REASONING ---------- */
  let reasoning = "";
  try {
    if (sessionId) {
      const result = await reasoningEngine.analyze(sessionId, message);
      reasoning = result.strategy || "";

      // Append service-specific fallback if multiple services detected
      if (detectedServices.length > 1) {
        const serviceFallbacks = detectedServices.map(
          (s) => `Optimize ${s} with targeted tactics.`
        );
        reasoning += "\n\n" + serviceFallbacks.join("\n");
      }
    }
  } catch {}

  if (!reasoning || reasoning.length < 20) {
    reasoning =
      "Focus on identifying the exact bottleneck per service and optimize each layer: traffic, conversion, and offer alignment.";
  }

  /* ---------- INTENT LEVEL ---------- */
  const highIntent = isHighIntent(message, stage, leadScore);
  if (highIntent) executionMode = "action";

  /* ---------- SERVICE ---------- */
  const recommendedService = detectedServices[0] || strategicMemory.lastService || null;
  const triggerBooking = highIntent || (leadScore >= 6 && stage === "service");

  /* ---------- RECENT CONTEXT ---------- */
  const recentContext = sessionId
    ? await memoryService.getRecentContext(sessionId).catch(() => [])
    : [];

  /* ---------- VECTOR CHUNKS ---------- */
  let fusedChunks: any[] = [];
  try {
    fusedChunks = await getFusedChunks(message, 3);
    fusedChunks = fusedChunks.filter((c) => c?.text && !/(contact|email|phone|http)/i.test(c.text));
  } catch {}

  /* ---------- SAVE MEMORY ---------- */
  if (sessionId) {
    try {
      await memoryService.updateStrategicMemory(sessionId, strategicMemory);
    } catch {}
  }

  /* ---------- FINAL CONTEXT ---------- */
  const brainContext: BrainContext = {
    message: userMessage,
    intent: primaryIntent,
    stage,
    leadScore,
    dealProbability: estimateDealProbability(stage, leadScore),
    recommendedService,
    triggerBooking,
    reasoning,
    recentContext,
    strategicMemory,
    detectedServices,
    unifiedIntentRanking,
    executionMode,
    highIntent,
    hasSufficientContext,
    dynamicGreeting:
      stage === "greeting" && leadScore < 0.5
        ? "Hey — what are you trying to improve right now?"
        : undefined,
  };

  return { brainContext, chunks: fusedChunks };
}
