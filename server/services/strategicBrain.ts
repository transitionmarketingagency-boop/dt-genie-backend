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
  dealProbability?: number;
  recommendedService?: string;
  triggerBooking?: boolean;
  reasoning?: string;
  recentContext?: { role: string; content: string }[];
  strategicMemory?: any;
};

/* ================= TEXT NORMALIZER ================= */

function normalizeText(text: string) {
  let t = (text || "").toLowerCase();

  const corrections: Record<string, string> = {
    schedual: "schedule",
    shedule: "schedule",
    bok: "book",
    cal: "call",
  };

  for (const wrong in corrections) {
    const regex = new RegExp(`\\b${wrong}\\b`, "g");
    t = t.replace(regex, corrections[wrong]);
  }

  return t.trim();
}

/* ================= GREETING DETECTOR ================= */

function isGreeting(text: string) {
  const greetings = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"];
  const lower = text.trim();
  return greetings.some((g) => lower === g || lower.startsWith(g + " "));
}

/* ================= BUSINESS SIGNAL DETECTOR ================= */

function detectBusinessSignals(text: string) {
  let signals = 0;

  const keywords = [
    "company","business","startup","agency","brand","store",
    "ecommerce","clients","revenue","real estate","team","marketing agency"
  ];

  for (const k of keywords) {
    if (text.includes(k)) signals++;
  }

  return Math.min(signals, 4);
}

/* ================= STAGE DETECTION (UPGRADED) ================= */

function detectStage(message: string): BrainContext["stage"] {
  const text = message;

  if (isGreeting(text)) return "greeting";

  if (
    text.includes("book") ||
    text.includes("schedule") ||
    text.includes("call") ||
    text.includes("hire") ||
    text.includes("consultation")
  ) return "conversion";

  if (
    text.includes("price") ||
    text.includes("cost") ||
    text.includes("package") ||
    text.includes("service")
  ) return "service";

  if (
    text.includes("how") ||
    text.includes("strategy") ||
    text.includes("grow") ||
    text.includes("scale") ||
    text.includes("improve")
  ) return "strategy";

  return "discovery";
}

/* ================= LEAD SCORING (UPGRADED) ================= */

function scoreLead(message: string) {
  const text = message;
  let score = 0;

  score += detectBusinessSignals(text);

  if (text.includes("seo")) score += 2;
  if (text.includes("ads")) score += 2;
  if (text.includes("automation")) score += 2;
  if (text.includes("ai")) score += 1;

  if (text.includes("hire") || text.includes("agency")) score += 3;

  if (text.includes("price") || text.includes("cost") || text.includes("budget")) score += 3;

  if (text.includes("need") || text.includes("looking for")) score += 2;

  return Math.min(score, 10);
}

/* ================= DEAL PROBABILITY ================= */

function estimateDealProbability(stage: BrainContext["stage"], leadScore: number) {
  let probability = 0.1;

  if (stage === "discovery") probability = 0.25;
  if (stage === "strategy") probability = 0.45;
  if (stage === "service") probability = 0.7;
  if (stage === "conversion") probability = 0.9;

  probability += leadScore * 0.025;

  return Math.min(probability, 0.95);
}

/* ================= SERVICE RECOMMENDER (UPGRADED) ================= */

function recommendService(message: string) {
  const text = message;

  const matches: { service: string; score: number }[] = [];

  if (text.includes("seo") || text.includes("ranking"))
    matches.push({ service: "SEO / GEO Optimization", score: 3 });

  if (text.includes("ads") || text.includes("advertising"))
    matches.push({ service: "Performance Marketing", score: 3 });

  if (text.includes("ai") || text.includes("automation"))
    matches.push({ service: "AI Marketing Automation", score: 2 });

  if (text.includes("real estate") || text.includes("property"))
    matches.push({ service: "CGI Property Tours", score: 3 });

  if (text.includes("branding") || text.includes("brand"))
    matches.push({ service: "Brand Development", score: 2 });

  if (text.includes("content"))
    matches.push({ service: "Content Marketing", score: 2 });

  if (text.includes("ecommerce"))
    matches.push({ service: "Ecommerce Growth Systems", score: 3 });

  if (!matches.length) return undefined;

  matches.sort((a, b) => b.score - a.score);

  return matches[0].service;
}

/* ================= BOOKING TRIGGER (REFINED) ================= */

function shouldTriggerBooking(stage: BrainContext["stage"], leadScore: number) {
  if (stage === "conversion") return true;
  if (stage === "service" && leadScore >= 7) return true;
  if (stage === "strategy" && leadScore >= 9) return true;
  return false;
}

/* ================= MAIN STRATEGIC BRAIN ================= */

export async function strategicBrain(userMessage: string, sessionId?: string) {
  const normalizedMessage = normalizeText(userMessage);

  const intents = getRelevantIntents(normalizedMessage, 1);
  const primaryIntent = intents.length > 0 ? intents[0].intent.name : "general";

  const stage = detectStage(normalizedMessage);

  let leadScore = scoreLead(normalizedMessage);

  let strategicMemory: any = {};
  if (sessionId) {
    try {
      strategicMemory = await memoryService.getStrategicMemory(sessionId);
      if (strategicMemory?.servicesDiscussed?.length) leadScore += 1;
      if (strategicMemory?.businessMentioned) leadScore += 1;
    } catch {
      strategicMemory = {};
    }
  }

  leadScore = Math.min(leadScore, 10);

  if (sessionId) {
    try {
      leadQualifier.scoreLead(sessionId, { need: leadScore / 10 });
    } catch {}
  }

  const dealProbability = estimateDealProbability(stage, leadScore);

  const recommendedService = recommendService(normalizedMessage);

  const triggerBooking = shouldTriggerBooking(stage, leadScore);

  let reasoning = generateReasoning(normalizedMessage);

  if (sessionId) {
    try {
      const reasoningData = await reasoningEngine.analyze(sessionId, normalizedMessage);
      reasoning = reasoningData?.strategy || reasoning;
    } catch {}
  }

  const chunks = await getFusedChunks(normalizedMessage, 5);

  let recentContext: any[] = [];
  if (sessionId) {
    try {
      recentContext = await memoryService.getRecentContext(sessionId);
    } catch {
      recentContext = [];
    }
  }

  const brainContext: BrainContext = {
    message: userMessage,
    intent: primaryIntent,
    stage,
    leadScore,
    dealProbability,
    recommendedService,
    triggerBooking,
    reasoning,
    recentContext: recentContext.map((m: any) => ({
      role: m.role,
      content: m.content,
    })),
    strategicMemory,
  };

  return {
    brainContext,
    chunks,
  };
}

/* ================= FALLBACK REASONING ================= */

function generateReasoning(message: string) {
  const text = message;

  if (text.includes("grow")) return "User wants business growth strategy";
  if (text.includes("ads")) return "User is interested in advertising solutions";
  if (text.includes("seo")) return "User is exploring search optimization";
  if (text.includes("automation")) return "User is exploring AI automation";

  return "General marketing inquiry";
}
