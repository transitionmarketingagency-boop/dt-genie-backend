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
  businessType?: string; // <-- ADDED
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
  let t = (text || "").toLowerCase();

  const corrections: Record<string, string> = {
    schedual: "schedule",
    shedule: "schedule",
    bok: "book",
    cal: "call",
  };

  for (const wrong in corrections) {
    t = t.replace(new RegExp(`\\b${wrong}\\b`, "g"), corrections[wrong]);
  }

  return t.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

/* ================= GREETING ================= */

function isGreeting(text: string) {
  const greetings = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"];
  return greetings.includes(text);
}

/* ================= GREETING ENGINE ================= */

function generateDynamicGreeting(memory?: StrategicMemory) {
  const hour = new Date().getHours();

  const base =
    hour < 12 ? "Good morning" :
    hour < 17 ? "Good afternoon" :
    hour < 22 ? "Good evening" : "Hey";

  const variations = [
    `${base} — what are you working on right now?`,
    `${base} — what are you trying to improve in your business?`,
    `${base} — what’s the main growth focus right now?`,
  ];

  const index = memory?.greetingIndex
    ? (memory.greetingIndex + 1) % variations.length
    : 0;

  if (memory) memory.greetingIndex = index;

  return variations[index];
}

/* ================= STAGE DETECTION ================= */

function detectStage(message: string): BrainContext["stage"] {
  const text = message.toLowerCase();

  if (isGreeting(text)) return "greeting";

  if (/(hire|work with you|get started|book|schedule|consult|call)/.test(text))
    return "conversion";

  if (/(price|cost|package|services)/.test(text))
    return "service";

  if (/(strategy|plan|how to|how do i|improve|optimize)/.test(text))
    return "strategy";

  return "discovery";
}

/* ================= LEAD SCORING ================= */

function scoreLead(message: string) {
  let score = 0;

  if (/(business|store|agency|company|clients|revenue)/.test(message)) score += 2;
  if (/(ads|roas|conversion|sales)/.test(message)) score += 3;
  if (/(seo|automation|marketing)/.test(message)) score += 2;
  if (/(hire|work with you|get started)/.test(message)) score += 3;
  if (/(price|cost)/.test(message)) score += 2;

  return Math.min(score, 10);
}

/* ================= DEAL ================= */

function estimateDealProbability(stage: BrainContext["stage"], leadScore: number) {
  const base = {
    greeting: 0.1,
    discovery: 0.25,
    strategy: 0.45,
    service: 0.7,
    conversion: 0.9,
  };

  return Math.min(base[stage] + leadScore * 0.03, 0.98);
}

/* ================= REASONING ================= */

function fallbackReasoning(message: string, services: any[]) {
  if (message.includes("roas")) {
    return "User is facing a performance marketing efficiency issue — likely related to ads, funnel, or creative.";
  }

  if (message.includes("sales")) {
    return "User wants to improve revenue — focus should be on conversion optimization and offer positioning.";
  }

  if (services?.length) {
    return `User is exploring ${services[0].value} related solutions.`;
  }

  return "User is exploring general marketing improvements.";
}

/* ================= MAIN ================= */

export async function strategicBrain(userMessage: string, sessionId?: string) {
  const message = normalizeText(userMessage);

  const strategicMemory: StrategicMemory = sessionId
    ? await memoryService.getStrategicMemory(sessionId).catch(() => ({}))
    : {};

  const stage = detectStage(message);

  let primaryIntent = "general";
  try {
    const intents = getRelevantIntents(message, 1);
    if (intents?.length) primaryIntent = intents[0].intent.name;
  } catch {}

  let detectedServices: any[] = [];
  try {
    detectedServices = detectIntents(message)
      .filter((i: any) => i.type === "service" && i.confidence > 0.4);
  } catch {}

  let leadScore = scoreLead(message);

  /* ===== CONTEXT FIX ===== */
  const hasSufficientContext: boolean =
    message.length > 12 &&
    (
      /(roas|ads|sales|conversion|seo|store|business|revenue)/.test(message) ||
      !!strategicMemory.businessMentioned ||
      (strategicMemory.servicesDiscussed?.length ?? 0) > 0 ||
      !!strategicMemory.lastUserProblem
    );

  if (hasSufficientContext) {
    strategicMemory.businessMentioned = true;
    strategicMemory.lastUserProblem = message;
  }

  let reasoning = "";
  try {
    const data: any = sessionId
      ? await reasoningEngine.analyze(sessionId, message)
      : {};
    reasoning = data?.strategy || fallbackReasoning(message, detectedServices);
  } catch {
    reasoning = fallbackReasoning(message, detectedServices);
  }

  if (detectedServices.length) {
    const existing = new Set(strategicMemory.servicesDiscussed || []);
    detectedServices.forEach((s: any) => existing.add(s.value));
    strategicMemory.servicesDiscussed = Array.from(existing);
    strategicMemory.lastService = detectedServices[0].value;
  }

  if (strategicMemory.businessMentioned) leadScore += 1;
  leadScore = Math.min(leadScore, 10);

  if (sessionId) {
    try {
      leadQualifier.scoreLead(sessionId, { need: leadScore / 10 });
    } catch {}
  }

  const recentContext = sessionId
    ? await memoryService.getRecentContext(sessionId).catch(() => [])
    : [];

  const brainContext: BrainContext = {
    message: userMessage,
    intent: primaryIntent,
    stage,
    leadScore,
    dealProbability: estimateDealProbability(stage, leadScore),
    recommendedService: detectedServices?.length
      ? detectedServices.sort((a, b) => b.confidence - a.confidence)[0].value
      : strategicMemory.lastService || null,
    triggerBooking: stage === "conversion" || leadScore >= 7,
    reasoning,
    recentContext,
    strategicMemory,
    detectedServices: detectedServices.map((d: any) => d.value),
    dynamicGreeting:
      stage === "greeting"
        ? generateDynamicGreeting(strategicMemory)
        : undefined,
    unifiedIntentRanking: [],
    hasSufficientContext,
  };

  let fusedChunks = strategicMemory.cachedFusedChunks ?? [];
  if (!fusedChunks.length) {
    fusedChunks = await getFusedChunks(message, 5).catch(() => []);
    strategicMemory.cachedFusedChunks = fusedChunks;
  }

  fusedChunks = fusedChunks.filter(
    (c: any) => c?.text && !/(contact|email|phone|http)/i.test(c.text)
  );

  return { brainContext, chunks: fusedChunks };
}
