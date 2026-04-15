import { memoryService } from "./memoryService.js";
import { leadQualifier } from "./leadQualifier.js";
import { neuralBrain } from "./neuralBrain.js";

/* ================= TYPES ================= */

export type StrategicMemory = {
  servicesDiscussed?: string[];
  industry?: string;
  businessType?: string;
  lastInteraction?: number;

  leadScore?: number;
  stage?: string;
  intentType?: string;
};

export type ExecutionMode = "execution" | "exploration";

export type BrainContext = {
  message: string;
  stage: "greeting" | "discovery" | "strategy" | "service" | "conversion";
  leadScore: number;
  detectedServices?: string[];
  executionMode: ExecutionMode;
  hasSufficientContext?: boolean;
  intentType?: string;
  highIntent?: boolean;

  shouldAskQuestion?: boolean;
  shouldGiveCTA?: boolean;
  confidenceLevel?: number;
};

/* ================= HELPERS ================= */

function normalize(text: string) {
  return (text || "").toLowerCase().trim();
}

function detectContextShift(message: string, memory: StrategicMemory): boolean {
  if (!memory) return false;

  const strongSignals = [
    "new business",
    "different business",
    "start over",
    "completely different",
  ];

  const weakSignals = [
    "i run",
    "i have",
    "my business",
    "my store",
    "we are",
  ];

  const hasStrong = strongSignals.some((s) => message.includes(s));
  const hasWeak = weakSignals.some((s) => message.includes(s));

  // 🔥 Phase 5 logic:
  // strong → always reset
  // weak → only reset if memory exists
  if (hasStrong) return true;
  if (hasWeak && (memory.industry || memory.businessType)) return true;

  return false;
}

/* ================= STAGE DETECTOR ================= */

function detectStage(
  message: string,
  intentType?: string
): BrainContext["stage"] {
  const msg = message.toLowerCase();

  if (intentType === "greeting") return "greeting";
  if (intentType === "booking") return "conversion";
  if (intentType === "service_inquiry") return "service";
  if (intentType === "problem") return "strategy";

  if (/(hire|book|schedule|call|start|work with you)/i.test(msg))
    return "conversion";

  if (/(price|cost|service|offer)/i.test(msg))
    return "service";

  if (/(how|improve|fix|scale|optimize|strategy)/i.test(msg))
    return "strategy";

  return "discovery";
}

/* ================= PHASE 5 DECISION ENGINE ================= */

function computeExecutionSignals(params: {
  stage: BrainContext["stage"];
  leadScore: number;
  highIntent: boolean;
  message: string;
}) {
  const { stage, leadScore, highIntent, message } = params;

  const isShort = message.length < 40;

  // 🔥 Phase 5 smarter blending (less rigid thresholds)
  const executionMode: ExecutionMode =
    highIntent || stage === "conversion" || leadScore >= 0.6
      ? "execution"
      : "exploration";

  const shouldGiveCTA =
    executionMode === "execution" ||
    leadScore >= 0.7 ||
    stage === "service";

  const shouldAskQuestion =
    executionMode === "exploration" &&
    !highIntent &&
    leadScore < 0.6 &&
    !isShort;

  const confidenceLevel = Math.min(
    1,
    leadScore * 0.7 + (highIntent ? 0.3 : 0)
  );

  return {
    executionMode,
    shouldGiveCTA,
    shouldAskQuestion,
    confidenceLevel,
  } as const;
}

/* ================= MAIN ENGINE ================= */

export async function strategicBrain(
  userMessage: string,
  sessionId?: string
): Promise<{ brainContext: BrainContext; chunks: [] }> {
  const message = normalize(userMessage);

  /* ---------- MEMORY ---------- */
  let strategicMemory: StrategicMemory = {};

  if (sessionId) {
    try {
      strategicMemory =
        (await memoryService.getStrategicMemory(sessionId)) || {};
    } catch {
      strategicMemory = {};
    }
  }

  /* ---------- CONTEXT SHIFT ---------- */
  const hasShift = detectContextShift(message, strategicMemory);

  if (hasShift && message.length > 20) {
    strategicMemory = {};
  }

  /* ---------- NEURAL INTENT ---------- */
  let intent: any = {};

  try {
    intent = neuralBrain(message) || {};
  } catch {
    intent = {};
  }

  const intentType = intent?.type || "general";
  const highIntent = Boolean(intent?.highIntent);

  /* ---------- LEAD SCORE ---------- */
  let leadScore = 0;

  try {
    const scoreResult = leadQualifier.scoreLead(sessionId || "anon", {
      need: intentType === "problem" ? 0.5 : 0.2,
      authority: highIntent ? 0.7 : 0.2,
    });

    leadScore = Number(scoreResult?.total || 0);
  } catch {
    leadScore = 0;
  }

  /* ---------- STAGE ---------- */
  const stage = detectStage(message, intentType);

  /* ---------- SIGNALS ---------- */
  const signals = computeExecutionSignals({
    stage,
    leadScore,
    highIntent,
    message,
  });

  /* ---------- CONTEXT QUALITY ---------- */
  const hasSufficientContext =
    message.length > 12 ||
    intentType === "problem" ||
    intentType === "service_inquiry" ||
    highIntent;

  /* ---------- FINAL OUTPUT ---------- */
  return {
    brainContext: {
      message: userMessage,
      stage,
      leadScore,
      detectedServices: strategicMemory.servicesDiscussed || [],
      executionMode: signals.executionMode,
      hasSufficientContext,
      intentType,
      highIntent,
      shouldAskQuestion: signals.shouldAskQuestion,
      shouldGiveCTA: signals.shouldGiveCTA,
      confidenceLevel: signals.confidenceLevel,
    },
    chunks: [],
  };
}
