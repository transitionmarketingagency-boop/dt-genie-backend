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
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function detectContextShift(message: string, memory: StrategicMemory): boolean {
  if (!message) return false;

  const strongSignals = [
    "new business",
    "different business",
    "start over",
    "completely different",
    "reset",
  ];

  const weakSignals = [
    "i run",
    "i have",
    "my business",
    "my store",
    "we are",
    "our company",
  ];

  const hasStrong = strongSignals.some((s) => message.includes(s));
  const hasWeak = weakSignals.some((s) => message.includes(s));

  const hasExistingMemory =
    !!memory?.industry ||
    !!memory?.businessType ||
    (memory?.servicesDiscussed?.length ?? 0) > 0;

  if (hasStrong) return true;
  if (hasWeak && hasExistingMemory) return true;

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

  if (/(hire|book|schedule|call|start|work with you|consult)/i.test(msg))
    return "conversion";

  if (/(price|cost|service|offer|plan|package)/i.test(msg))
    return "service";

  if (/(how|improve|fix|scale|optimize|strategy|grow|increase)/i.test(msg))
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

  const isShort = message.length < 35;

  const executionMode: ExecutionMode =
    highIntent || stage === "conversion" || leadScore >= 0.65
      ? "execution"
      : "exploration";

  const shouldGiveCTA =
    executionMode === "execution" ||
    leadScore >= 0.75 ||
    stage === "service";

  const shouldAskQuestion =
    executionMode === "exploration" &&
    leadScore < 0.6 &&
    !highIntent &&
    !isShort;

  const confidenceLevel = Math.min(
    1,
    leadScore * 0.75 + (highIntent ? 0.25 : 0)
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

  if (hasShift) {
    strategicMemory = {
      servicesDiscussed: [],
      industry: undefined,
      businessType: undefined,
      leadScore: 0,
      stage: "discovery",
    };
  }

  /* ---------- NEURAL INTENT ---------- */
  let intent: any = {};

  try {
    intent = neuralBrain?.(message) || {};
  } catch {
    intent = {};
  }

  const intentType = intent?.type || "general";
  const highIntent = Boolean(intent?.highIntent);

  /* ---------- LEAD SCORE ---------- */
  let leadScore = 0;

  try {
    const scoreResult = leadQualifier?.scoreLead?.(sessionId || "anon", {
      need: intentType === "problem" ? 0.55 : 0.25,
      authority: highIntent ? 0.75 : 0.25,
    });

    leadScore = Number(scoreResult?.total ?? 0);
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
    message.length > 10 ||
    intentType === "problem" ||
    intentType === "service_inquiry" ||
    highIntent;

  /* ---------- FINAL OUTPUT ---------- */
  return {
    brainContext: {
      message: userMessage,
      stage,
      leadScore,
      detectedServices: strategicMemory?.servicesDiscussed || [],
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
