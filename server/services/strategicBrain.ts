import { getRelevantIntents } from "./intentManager.js";
import { getFusedChunks } from "./intentVectorFusion.js";
import { memoryService } from "./memoryService.js";
import { leadQualifier } from "./leadQualifier.js";
import { reasoningEngine } from "./reasoningEngine.js";

/* ================= TYPES ================= */

export type BrainContext = {
  message: string;

  intent?: string;

  stage:
    | "greeting"
    | "discovery"
    | "strategy"
    | "service"
    | "conversion";

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
  let t = text.toLowerCase();

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
  const greetings = [
    "hi",
    "hello",
    "hey",
    "good morning",
    "good afternoon",
    "good evening",
  ];

  const lower = text.trim();

  return greetings.some(
    (g) => lower === g || lower.startsWith(g + " ")
  );
}

/* ================= BUSINESS SIGNAL DETECTOR ================= */

function detectBusinessSignals(text: string) {
  let signals = 0;

  const keywords = [
    "company",
    "business",
    "startup",
    "agency",
    "brand",
    "store",
    "ecommerce",
    "clients",
    "revenue",
    "real estate",
    "studio",
    "team",
    "marketing agency",
  ];

  for (const k of keywords) {
    if (text.includes(k)) signals++;
  }

  return Math.min(signals, 4);
}

/* ================= STAGE DETECTION ================= */

function detectStage(message: string): BrainContext["stage"] {

  const text = message;

  if (isGreeting(text)) return "greeting";

  /* conversion signals first (highest intent) */

  if (
    text.includes("hire") ||
    text.includes("work with") ||
    text.includes("book") ||
    text.includes("schedule") ||
    text.includes("call") ||
    text.includes("consultation")
  )
    return "conversion";

  /* service interest */

  if (
    text.includes("service") ||
    text.includes("price") ||
    text.includes("cost") ||
    text.includes("offer") ||
    text.includes("packages")
  )
    return "service";

  /* strategic questions */

  if (
    text.includes("how") ||
    text.includes("strategy") ||
    text.includes("grow") ||
    text.includes("improve") ||
    text.includes("scale")
  )
    return "strategy";

  return "discovery";
}

/* ================= LEAD SCORING ================= */

function scoreLead(message: string) {

  const text = message;

  let score = 0;

  score += detectBusinessSignals(text);

  if (text.includes("marketing")) score += 1;
  if (text.includes("seo")) score += 2;
  if (text.includes("ads")) score += 2;
  if (text.includes("automation")) score += 2;

  if (text.includes("hire")) score += 3;
  if (text.includes("agency")) score += 2;

  if (text.includes("price")) score += 3;
  if (text.includes("cost")) score += 3;
  if (text.includes("budget")) score += 3;

  return Math.min(score, 10);
}

/* ================= DEAL PROBABILITY ================= */

function estimateDealProbability(
  stage: BrainContext["stage"],
  leadScore: number
) {

  let probability = 0.1;

  if (stage === "discovery") probability = 0.25;
  if (stage === "strategy") probability = 0.4;
  if (stage === "service") probability = 0.65;
  if (stage === "conversion") probability = 0.85;

  probability += leadScore * 0.03;

  return Math.min(probability, 0.95);
}

/* ================= SERVICE RECOMMENDER ================= */

function recommendService(message: string) {

  const text = message;

  if (text.includes("seo") || text.includes("ranking"))
    return "SEO / GEO Optimization";

  if (text.includes("ads") || text.includes("advertising"))
    return "Performance Marketing";

  if (text.includes("ai"))
    return "AI Marketing Automation";

  if (text.includes("real estate") || text.includes("property"))
    return "CGI Property Tours";

  if (text.includes("cgi ad"))
    return "CGI Advertising";

  if (text.includes("music") || text.includes("audio"))
    return "Music Production";

  if (text.includes("brand") || text.includes("branding"))
    return "Brand Development";

  if (text.includes("content"))
    return "Content Marketing";

  if (text.includes("ecommerce"))
    return "Ecommerce Growth Systems";

  return undefined;
}

/* ================= BOOKING TRIGGER (SOFT SIGNAL) ================= */

function shouldTriggerBooking(
  stage: BrainContext["stage"],
  leadScore: number
) {

  if (stage === "conversion") return true;

  if (stage === "service" && leadScore >= 6) return true;

  if (stage === "strategy" && leadScore >= 8) return true;

  return false;
}

/* ================= MAIN STRATEGIC BRAIN ================= */

export async function strategicBrain(
  userMessage: string,
  sessionId?: string
) {

  const normalizedMessage = normalizeText(userMessage);

  /* ---------- INTENT DETECTION ---------- */

  const intents = getRelevantIntents(normalizedMessage, 1);

  const primaryIntent =
    intents.length > 0
      ? intents[0].intent.name
      : "general";

  /* ---------- STAGE ---------- */

  const stage = detectStage(normalizedMessage);

  /* ---------- LEAD SCORE ---------- */

  let leadScore = scoreLead(normalizedMessage);

  /* ---------- STRATEGIC MEMORY ---------- */

  let strategicMemory: any = {};

  if (sessionId) {

    try {

      strategicMemory =
        await memoryService.getStrategicMemory(sessionId);

      if (strategicMemory?.servicesDiscussed?.length) {
        leadScore += 1;
      }

      if (strategicMemory?.businessMentioned) {
        leadScore += 1;
      }

    } catch {
      strategicMemory = {};
    }

  }

  leadScore = Math.min(leadScore, 10);

  /* ---------- LEAD QUALIFIER ---------- */

  if (sessionId) {

    try {

      leadQualifier.scoreLead(sessionId, {
        need: leadScore / 10
      });

    } catch {}

  }

  /* ---------- DEAL PROBABILITY ---------- */

  const dealProbability =
    estimateDealProbability(stage, leadScore);

  /* ---------- SERVICE RECOMMENDATION ---------- */

  const recommendedService =
    recommendService(normalizedMessage);

  /* ---------- BOOKING SIGNAL ---------- */

  const triggerBooking =
    shouldTriggerBooking(stage, leadScore);

  /* ---------- REASONING ---------- */

  let reasoning =
    generateReasoning(normalizedMessage);

  if (sessionId) {

    try {

      const reasoningData =
        await reasoningEngine.analyze(
          sessionId,
          normalizedMessage
        );

      reasoning =
        reasoningData?.strategy || reasoning;

    } catch {}

  }

  /* ---------- KNOWLEDGE CHUNKS ---------- */

  const chunks =
    await getFusedChunks(normalizedMessage, 5);

  /* ---------- CONTEXT ---------- */

  let recentContext: any[] = [];

  if (sessionId) {

    try {

      recentContext =
        await memoryService.getRecentContext(sessionId);

    } catch {
      recentContext = [];
    }

  }

  /* ---------- FINAL CONTEXT ---------- */

  const brainContext: BrainContext = {

    message: userMessage,

    intent: primaryIntent,

    stage,

    leadScore,

    dealProbability,

    recommendedService,

    triggerBooking,

    reasoning,

    recentContext: (recentContext || []).map((m: any) => ({
      role: m.role,
      content: m.content
    })),

    strategicMemory

  };

  return {
    brainContext,
    chunks
  };

}

/* ================= FALLBACK REASONING ================= */

function generateReasoning(message: string) {

  const text = message;

  if (text.includes("grow"))
    return "User wants business growth strategy";

  if (text.includes("ads"))
    return "User is interested in advertising solutions";

  if (text.includes("seo"))
    return "User is exploring search optimization";

  if (text.includes("automation"))
    return "User is exploring AI automation";

  return "General marketing inquiry";

}
