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

  // Remove non-alphanumeric except spaces
  return t.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

/* ================= GREETING ================= */

function isGreeting(text: string) {
  const greetings = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"];
  return greetings.some(g => text.startsWith(g));
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

  const index = memory?.greetingIndex !== undefined
    ? (memory.greetingIndex + 1) % variations.length
    : 0;

  if (memory) memory.greetingIndex = index;

  return variations[index];
}

/* ================= STAGE DETECTION ================= */

function detectStage(message: string): BrainContext["stage"] {
  const text = message.toLowerCase();

  if (isGreeting(text)) return "greeting";

  if (/(hire|work with you|get started|book|schedule|consult|call)/i.test(text))
    return "conversion";

  if (/(price|cost|package|services)/i.test(text))
    return "service";

  if (/(strategy|plan|how to|how do i|improve|optimize)/i.test(text))
    return "strategy";

  return "discovery";
}

/* ================= LEAD SCORING ================= */

function scoreLead(message: string) {
  let score = 0;

  if (/(business|store|agency|company|clients|revenue)/i.test(message)) score += 2;
  if (/(ads|roas|conversion|sales)/i.test(message)) score += 3;
  if (/(seo|automation|marketing)/i.test(message)) score += 2;
  if (/(hire|work with you|get started)/i.test(message)) score += 3;
  if (/(price|cost)/i.test(message)) score += 2;

  return Math.min(score, 10);
}

/* ================= DEAL PROBABILITY ================= */

function estimateDealProbability(stage: BrainContext["stage"], leadScore: number) {
  const base: Record<BrainContext["stage"], number> = {
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
  if (/roas/i.test(message)) {
    return "User is facing a performance marketing efficiency issue — likely related to ads, funnel, or creative.";
  }

  if (/sales/i.test(message)) {
    return "User wants to improve revenue — focus should be on conversion optimization and offer positioning.";
  }

  if (services?.length) {
    return `User is exploring ${services[0].value} related solutions.`;
  }

  return "User is exploring general marketing improvements.";
}

/* ================= MAIN FUNCTION ================= */

export async function strategicBrain(userMessage: string, sessionId?: string) {
  const message = normalizeText(userMessage);

  // Load or initialize strategic memory
  const strategicMemory: StrategicMemory = sessionId
    ? await memoryService.getStrategicMemory(sessionId).catch(() => ({}))
    : {};

  const stage = detectStage(message);

  // Detect primary intent
  let primaryIntent = "general";
  try {
    const intents = getRelevantIntents(message, 1);
    if (intents?.length) primaryIntent = intents[0].intent.name;
  } catch {}

  // Detect services
  let detectedServices: any[] = [];
  try {
    detectedServices = detectIntents(message)
      .filter(i => i.type === "service" && i.confidence > 0.4);
  } catch {}

  let leadScore = scoreLead(message);

  /* ===== CONTEXT CHECK ===== */
  const hasSufficientContext =
    message.length > 12 &&
    (
      /(roas|ads|sales|conversion|seo|store|business|revenue)/i.test(message) ||
      strategicMemory.businessMentioned ||
      (strategicMemory.servicesDiscussed?.length ?? 0) > 0 ||
      !!strategicMemory.lastUserProblem
    );

  if (hasSufficientContext) {
    strategicMemory.businessMentioned = true;
    strategicMemory.lastUserProblem = message;
  }

  // Generate reasoning
  let reasoning = "";
  try {
    const data: any = sessionId
      ? await reasoningEngine.analyze(sessionId, message)
      : {};
    reasoning = data?.strategy || fallbackReasoning(message, detectedServices);
  } catch {
    reasoning = fallbackReasoning(message, detectedServices);
  }

  // Update memory with detected services
  if (detectedServices.length) {
    const existing = new Set(strategicMemory.servicesDiscussed || []);
    detectedServices.forEach(s => existing.add(s.value));
    strategicMemory.servicesDiscussed = Array.from(existing);
    strategicMemory.lastService = detectedServices[0].value;
  }

  // Boost lead score if business mentioned
  if (strategicMemory.businessMentioned) leadScore += 1;
  leadScore = Math.min(leadScore, 10);

  // Update lead score in external system
  if (sessionId) {
    try {
      leadQualifier.scoreLead(sessionId, { need: leadScore / 10 });
    } catch {}
  }

  const recentContext = sessionId
    ? await memoryService.getRecentContext(sessionId).catch(() => [])
    : [];

  // Brain context
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
    detectedServices: detectedServices.map(d => d.value),
    dynamicGreeting:
      stage === "greeting"
        ? generateDynamicGreeting(strategicMemory)
        : undefined,
    unifiedIntentRanking: [],
    hasSufficientContext,
  };

  // Fused chunks
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
