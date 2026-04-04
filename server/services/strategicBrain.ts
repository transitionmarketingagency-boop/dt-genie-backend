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
  [key: string]: any;
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
  return greetings.some((g) => text === g || text.startsWith(g + " "));
}

/* ================= DYNAMIC GREETING ================= */

function generateDynamicGreeting(memory?: StrategicMemory) {
  const hour = new Date().getHours();

  const base =
    hour < 12 ? "Good morning" :
    hour < 17 ? "Good afternoon" :
    hour < 22 ? "Good evening" : "Hi";

  const variations = [
    `${base}! What are you working on right now?`,
    `${base}! What are you trying to improve in your business?`,
    `${base}! Let’s focus on growth — what’s the goal?`,
  ];

  const index = memory?.greetingIndex
    ? (memory.greetingIndex + 1) % variations.length
    : 0;

  if (memory) memory.greetingIndex = index;

  return variations[index];
}

/* ================= BUSINESS SIGNAL ================= */

function detectBusinessSignals(text: string) {
  const keywords = [
    "company","business","startup","agency","brand","store",
    "ecommerce","clients","revenue","real estate","team"
  ];

  return Math.min(keywords.filter(k => text.includes(k)).length, 4);
}

/* ================= STAGE ================= */

function detectStage(message: string): BrainContext["stage"] {
  const text = message.toLowerCase();

  if (isGreeting(text) && text.split(" ").length <= 3) return "greeting";

  if (/(hire|work with you|start|book|schedule|call)/.test(text)) return "conversion";

  if (/(price|cost|package)/.test(text)) return "service";

  if (/(strategy|plan|how do i|how to)/.test(text)) return "strategy";

  return "discovery";
}

/* ================= LEAD ================= */

function scoreLead(message: string) {
  let score = detectBusinessSignals(message);

  if (/\bseo\b/.test(message)) score += 2;
  if (/\bads\b/.test(message)) score += 2;
  if (/\bautomation\b/.test(message)) score += 2;
  if (message.includes("hire")) score += 3;
  if (message.includes("price")) score += 3;
  if (message.includes("need") || message.includes("looking")) score += 2;

  return Math.min(score, 10);
}

/* ================= DEAL ================= */

function estimateDealProbability(stage: BrainContext["stage"], leadScore: number) {
  const base = {
    discovery: 0.25,
    strategy: 0.45,
    service: 0.7,
    conversion: 0.9,
    greeting: 0.1,
  };

  return Math.min(base[stage] + leadScore * 0.025, 0.95);
}

/* ================= REASONING ================= */

function generateReasoning(message: string, services: any[]) {
  if (services?.length) return `User interested in ${services[0].value}`;
  if (message.includes("roas")) return "User has performance marketing issue";
  if (message.includes("sales")) return "User wants to increase sales";
  return "General marketing inquiry";
}

/* ================= SERVICE PICK ================= */

function pickRecommendedService(services: any[]) {
  if (!services?.length) return null;
  return services.sort((a, b) => b.confidence - a.confidence)[0].value;
}

/* ================= MAIN ================= */

export async function strategicBrain(userMessage: string, sessionId?: string) {
  const message = normalizeText(userMessage);

  const stage = detectStage(message);
  let leadScore = scoreLead(message);

  /* ===== INTENT ===== */
  let primaryIntent = "general";
  try {
    const intents = getRelevantIntents(message, 1);
    if (intents?.length) primaryIntent = intents[0].intent.name;
  } catch {}

  /* ===== MEMORY ===== */
  const strategicMemory: StrategicMemory = sessionId
    ? await memoryService.getStrategicMemory(sessionId).catch(() => ({}))
    : {};

  /* ===== SERVICES ===== */
  let detectedServices: any[] = [];
  try {
    detectedServices = detectIntents(message)
      .filter((i: any) => i.type === "service" && i.confidence > 0.4);
  } catch {}

  /* ===== CONTEXT FIX (CRITICAL) ===== */
  const hasSufficientContext: boolean =
    message.length > 15 &&
    (
      /(ads|roas|sales|store|ecommerce|business|clients|revenue)/i.test(message) ||
      strategicMemory?.businessMentioned === true ||
      (strategicMemory?.servicesDiscussed?.length ?? 0) > 0
    );

  if (hasSufficientContext) {
    strategicMemory.businessMentioned = true;
  }

  /* ===== REASONING (NO CACHE) ===== */
  let reasoning = "";
  try {
    const data: any = sessionId
      ? await reasoningEngine.analyze(sessionId, message)
      : {};

    reasoning = data?.strategy || generateReasoning(message, detectedServices);
  } catch {
    reasoning = generateReasoning(message, detectedServices);
  }

  /* ===== MEMORY EVOLUTION ===== */
  if (detectedServices.length) {
    const existing = new Set(strategicMemory.servicesDiscussed || []);
    detectedServices.forEach((s: any) => existing.add(s.value));
    strategicMemory.servicesDiscussed = Array.from(existing);
  }

  /* ===== LEAD BOOST ===== */
  if (strategicMemory.businessMentioned) leadScore += 1;
  leadScore = Math.min(leadScore, 10);

  /* ===== TRACK LEAD ===== */
  if (sessionId) {
    try {
      leadQualifier.scoreLead(sessionId, { need: leadScore / 10 });
    } catch {}
  }

  /* ===== CONTEXT ===== */
  const recentContext = sessionId
    ? await memoryService.getRecentContext(sessionId).catch(() => [])
    : [];

  /* ===== OUTPUT ===== */
  const brainContext: BrainContext = {
    message: userMessage,
    intent: primaryIntent,
    stage,
    leadScore,
    dealProbability: estimateDealProbability(stage, leadScore),
    recommendedService: pickRecommendedService(detectedServices),
    triggerBooking: stage === "conversion" || leadScore >= 8,
    reasoning,
    recentContext,
    strategicMemory,
    detectedServices: detectedServices.map((d: any) => d.value),
    dynamicGreeting: stage === "greeting"
      ? generateDynamicGreeting(strategicMemory)
      : undefined,
    unifiedIntentRanking: [],
    hasSufficientContext,
  };

  /* ===== CHUNKS ===== */
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
