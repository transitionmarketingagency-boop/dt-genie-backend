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
  cachedFusedChunks?: any[];
  industry?: string;
  lastUserProblem?: string;
  lastService?: string;
  businessType?: string;
  goals?: string[];
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
  hasSufficientContext?: boolean;
};

/* ================= NORMALIZER ================= */

function normalizeText(text: string) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ================= GREETING ================= */

function isGreeting(text: string) {
  return /^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(text);
}

function generateDynamicGreeting(memory?: StrategicMemory) {
  const hour = new Date().getHours();

  const base =
    hour < 12 ? "Good morning" :
    hour < 17 ? "Good afternoon" :
    hour < 22 ? "Good evening" : "Hey";

  const variations = [
    `${base} — what are you trying to improve right now?`,
    `${base} — what’s your main growth challenge?`,
    `${base} — what are you working on currently?`,
  ];

  const index = memory?.greetingIndex !== undefined
    ? (memory.greetingIndex + 1) % variations.length
    : 0;

  if (memory) memory.greetingIndex = index;

  return variations[index];
}

/* ================= STAGE ================= */

function detectStage(message: string): BrainContext["stage"] {
  if (isGreeting(message)) return "greeting";

  if (/(hire|book|schedule|call|start|work with)/i.test(message))
    return "conversion";

  if (/(price|cost|services|package)/i.test(message))
    return "service";

  if (/(strategy|how|improve|optimize|plan)/i.test(message))
    return "strategy";

  return "discovery";
}

/* ================= DEAL PROBABILITY ================= */

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

/* ================= MAIN ================= */

export async function strategicBrain(userMessage: string, sessionId?: string) {
  const message = normalizeText(userMessage);

  /* ---------- MEMORY LOAD ---------- */
  const strategicMemory: StrategicMemory = sessionId
    ? await memoryService.getStrategicMemory(sessionId).catch(() => ({}))
    : {};

  const stage = detectStage(message);

  /* ---------- INTENTS ---------- */
  let unifiedIntentRanking: { intent: string; score: number }[] = [];
  let primaryIntent = "general";

  try {
    const intents = getRelevantIntents(message, 3);
    unifiedIntentRanking = intents.map(i => ({
      intent: i.intent.name,
      score: i.score
    }));

    if (intents.length) primaryIntent = intents[0].intent.name;
  } catch {}

  /* ---------- SERVICES ---------- */
  let detectedServices: any[] = [];
  try {
    detectedServices = detectIntents(message)
      .filter(i => i.type === "service" && i.confidence > 0.4);
  } catch {}

  /* ---------- CONTEXT CHECK ---------- */
  const hasSufficientContext =
    message.length > 10 &&
    (
      /(roas|ads|sales|conversion|seo|revenue|store|business)/i.test(message) ||
      strategicMemory.businessMentioned ||
      (strategicMemory.servicesDiscussed?.length ?? 0) > 0
    );

  if (hasSufficientContext) {
    strategicMemory.businessMentioned = true;
    strategicMemory.lastUserProblem = message;
  }

  /* ---------- REASONING ---------- */
  let reasoning = "";

  try {
    if (sessionId) {
      const result = await reasoningEngine.analyze(sessionId, message);
      reasoning = result.strategy;
    }
  } catch {}

  if (!reasoning) {
    reasoning = "Focus on improving acquisition, conversion, and retention systems.";
  }

  /* ---------- LEAD SCORING (REAL) ---------- */
  let leadScore = 0;

  if (sessionId) {
    try {
      const result = leadQualifier.scoreLead(sessionId, {
        need: hasSufficientContext ? 0.7 : 0.2
      });
      leadScore = result.total * 10;
    } catch {}
  }

  /* ---------- SERVICE MEMORY ---------- */
  if (detectedServices.length) {
    const existing = new Set(strategicMemory.servicesDiscussed || []);
    detectedServices.forEach(s => existing.add(s.value));
    strategicMemory.servicesDiscussed = Array.from(existing);
    strategicMemory.lastService = detectedServices[0].value;
  }

  /* ---------- RECOMMENDATION ---------- */
  const recommendedService =
    detectedServices.length
      ? detectedServices.sort((a, b) => b.confidence - a.confidence)[0].value
      : strategicMemory.lastService || null;

  /* ---------- BOOKING TRIGGER (SMART) ---------- */
  const triggerBooking =
    stage === "conversion" ||
    leadScore >= 7 ||
    (leadScore >= 5 && stage === "service");

  /* ---------- CONTEXT ---------- */
  const recentContext = sessionId
    ? await memoryService.getRecentContext(sessionId).catch(() => [])
    : [];

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
    detectedServices: detectedServices.map(d => d.value),
    dynamicGreeting:
      stage === "greeting"
        ? generateDynamicGreeting(strategicMemory)
        : undefined,
    unifiedIntentRanking,
    hasSufficientContext,
  };

  /* ---------- CHUNKS ---------- */
  let fusedChunks = strategicMemory.cachedFusedChunks ?? [];

  if (!fusedChunks.length) {
    fusedChunks = await getFusedChunks(message, 5).catch(() => []);
    strategicMemory.cachedFusedChunks = fusedChunks;
  }

  fusedChunks = fusedChunks.filter(
    c => c?.text && !/(contact|email|phone|http)/i.test(c.text)
  );

  return { brainContext, chunks: fusedChunks };
}
