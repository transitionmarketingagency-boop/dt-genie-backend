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

  const lower = text.toLowerCase();

  return greetings.some(
    (g) => lower === g || lower.startsWith(g + " ")
  );
}

/* ================= STAGE DETECTION ================= */

function detectStage(message: string): BrainContext["stage"] {
  const text = message.toLowerCase();

  if (isGreeting(text)) return "greeting";

  if (
    text.includes("how") ||
    text.includes("strategy") ||
    text.includes("grow") ||
    text.includes("improve")
  )
    return "strategy";

  if (
    text.includes("service") ||
    text.includes("price") ||
    text.includes("cost") ||
    text.includes("offer")
  )
    return "service";

  if (
    text.includes("hire") ||
    text.includes("work with") ||
    text.includes("book") ||
    text.includes("schedule") ||
    text.includes("call")
  )
    return "conversion";

  return "discovery";
}

/* ================= LEAD SCORING ================= */

function scoreLead(message: string) {
  let score = 0;

  const text = message.toLowerCase();

  if (text.includes("business")) score += 1;
  if (text.includes("company")) score += 1;
  if (text.includes("brand")) score += 1;
  if (text.includes("startup")) score += 1;

  if (text.includes("hire")) score += 2;
  if (text.includes("agency")) score += 1;

  if (text.includes("marketing")) score += 1;
  if (text.includes("seo")) score += 1;
  if (text.includes("ads")) score += 1;

  if (text.includes("price")) score += 2;
  if (text.includes("cost")) score += 2;

  return Math.min(score, 10);
}

/* ================= DEAL PROBABILITY ================= */

function estimateDealProbability(stage: string, leadScore: number) {
  let probability = 0.1;

  if (stage === "discovery") probability = 0.25;
  if (stage === "strategy") probability = 0.4;
  if (stage === "service") probability = 0.6;
  if (stage === "conversion") probability = 0.85;

  probability += leadScore * 0.03;

  return Math.min(probability, 0.95);
}

/* ================= SERVICE RECOMMENDER ================= */

function recommendService(message: string) {
  const text = message.toLowerCase();

  if (text.includes("seo") || text.includes("ranking"))
    return "SEO / GEO Optimization";

  if (text.includes("ads") || text.includes("advertising"))
    return "Performance Marketing";

  if (text.includes("ai"))
    return "AI Marketing Automation";

  if (text.includes("real estate") || text.includes("property"))
    return "CGI Property Tours";

  if (text.includes("brand") || text.includes("branding"))
    return "Brand Development";

  return undefined;
}

/* ================= BOOKING TRIGGER ================= */

function shouldTriggerBooking(stage: string, leadScore: number) {
  if (stage === "conversion") return true;

  if (stage === "service" && leadScore >= 5) return true;

  return false;
}

/* ================= MAIN STRATEGIC BRAIN ================= */

export async function strategicBrain(
  userMessage: string,
  sessionId?: string
) {

  /* ----- Intent Detection ----- */

  const intents = getRelevantIntents(userMessage, 1);

  const primaryIntent =
    intents.length > 0
      ? intents[0].intent.name
      : "general";

  /* ----- Stage ----- */

  const stage = detectStage(userMessage);

  /* ----- Lead Score ----- */

  let leadScore = scoreLead(userMessage);

  /* ----- Strategic Memory Influence ----- */

  let strategicMemory: any = {};

  if (sessionId) {
    strategicMemory =
      await memoryService.getStrategicMemory(sessionId);

    if (strategicMemory?.servicesDiscussed?.length) {
      leadScore += 1;
    }
  }

  leadScore = Math.min(leadScore, 10);

  /* ----- Lead Qualification System ----- */

  if (sessionId) {
    leadQualifier.scoreLead(sessionId, {
      need: leadScore / 10,
    });
  }

  /* ----- Deal Probability ----- */

  const dealProbability = estimateDealProbability(
    stage,
    leadScore
  );

  /* ----- Service Recommendation ----- */

  const recommendedService = recommendService(userMessage);

  /* ----- Booking Trigger ----- */

  const triggerBooking = shouldTriggerBooking(
    stage,
    leadScore
  );

  /* ----- Reasoning Engine ----- */

  let reasoning = generateReasoning(userMessage);

  if (sessionId) {
    try {
      const reasoningData =
        await reasoningEngine.analyze(
          sessionId,
          userMessage
        );

      reasoning = reasoningData.strategy || reasoning;
    } catch {
      // fallback silently
    }
  }

  /* ----- Knowledge Chunks ----- */

  const chunks = await getFusedChunks(userMessage, 5);

  /* ----- Recent Context ----- */

  const recentContext = sessionId
    ? await memoryService.getRecentContext(sessionId)
    : [];

  /* ----- Brain Context ----- */

  const brainContext: BrainContext = {
    message: userMessage,
    intent: primaryIntent,
    stage,
    leadScore,
    dealProbability,
    recommendedService,
    triggerBooking,
    reasoning,
    recentContext: recentContext.map((m) => ({
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
  const text = message.toLowerCase();

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
