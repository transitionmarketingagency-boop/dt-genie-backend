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

/* ================= IMPROVED GREETING DETECTION ================= */
function isGreeting(message: string) {
  return /^(hi|hello|hey|yo|hi there|hello there|hey there)\b/i.test(message);
}

function isShortMessage(message: string) {
  return message.length < 8;
}

/* ================= IMPROVED CONTEXT SHIFT (FIXED STABILITY) ================= */
function detectContextShift(message: string, memory: StrategicMemory): boolean {
  const strongSignals = ["new business", "different business", "reset", "start over"];

  const hasStrong = strongSignals.some((s) => message.includes(s));

  const hasMemory =
    !!memory?.industry ||
    !!memory?.businessType ||
    (memory?.servicesDiscussed?.length ?? 0) > 0;

  // 🔥 FIX: ONLY reset on explicit instruction (no weak resets anymore)
  return hasStrong && hasMemory;
}

/* ================= STAGE DETECTOR (STABILIZED) ================= */

function detectStage(
  message: string,
  intentType?: string
): BrainContext["stage"] {
  if (intentType === "greeting") return "greeting";
  if (intentType === "booking") return "conversion";
  if (intentType === "service_inquiry") return "service";
  if (intentType === "problem") return "strategy";

  if (/(hire|book|start|work with you|get started)/i.test(message)) return "conversion";

  if (/(price|cost|service|offer|package)/i.test(message)) return "service";

  if (/(how|fix|improve|scale|grow|increase|optimize)/i.test(message)) {
    return "strategy";
  }

  return "discovery";
}

/* ================= EXECUTION SIGNALS (FIXED LOGIC) ================= */

function computeExecutionSignals(params: {
  stage: BrainContext["stage"];
  leadScore: number;
  highIntent: boolean;
  message: string;
  confidence: number;
}) {
  const { stage, leadScore, highIntent, message, confidence } = params;

  const shortMsg = isShortMessage(message);

  /* 🔥 FIX: execution now requires CONFIDENCE + intent */
  const executionMode: ExecutionMode =
    highIntent && confidence > 0.6 && !shortMsg
      ? "execution"
      : leadScore >= 0.75 && confidence > 0.7 && stage !== "greeting"
      ? "execution"
      : "exploration";

  /* 🔥 FIX: CTA is more conservative */
  const shouldGiveCTA =
    !shortMsg &&
    confidence > 0.6 &&
    (highIntent || leadScore >= 0.8 || stage === "conversion");

  /* 🔥 FIX: avoid unnecessary questioning */
  const shouldAskQuestion =
    !shortMsg &&
    stage === "discovery" &&
    leadScore < 0.65 &&
    confidence < 0.6 &&
    !highIntent;

  const confidenceLevel = Math.min(1, confidence);

  return {
    executionMode,
    shouldGiveCTA,
    shouldAskQuestion,
    confidenceLevel,
  };
}

/* ================= MAIN ================= */

export async function strategicBrain(
  userMessage: string,
  sessionId?: string
): Promise<{ brainContext: BrainContext; chunks: [] }> {
  const message = normalize(userMessage);

  let strategicMemory: StrategicMemory = {};

  if (sessionId) {
    try {
      strategicMemory =
        (await memoryService.getStrategicMemory(sessionId)) || {};
    } catch {
      strategicMemory = {};
    }
  }

  /* ---------- CONTEXT SHIFT (SAFE) ---------- */
  if (detectContextShift(message, strategicMemory)) {
    strategicMemory = {
      servicesDiscussed: [],
      industry: undefined,
      businessType: undefined,
      leadScore: 0,
      stage: "discovery",
    };
  }

  /* ---------- INTENT ---------- */
  let intent: any = {};

  try {
    intent = neuralBrain?.(message) || {};
  } catch {
    intent = {};
  }

  const intentType = intent?.type || "general";
  const highIntent = Boolean(intent?.highIntent);

  /* ---------- LEAD SCORE (STABILIZED) ---------- */
  let leadScore = 0;

  try {
    const scoreResult = leadQualifier?.scoreLead?.(sessionId || "anon", {
      need: intentType === "problem" ? 0.6 : 0.3,
      authority: highIntent ? 0.8 : 0.3,
    });

    leadScore = Number(scoreResult?.total ?? 0);
  } catch {
    leadScore = 0;
  }

  /* ---------- STAGE ---------- */
  const stage = isGreeting(message)
    ? "greeting"
    : detectStage(message, intentType);

  /* ---------- CONFIDENCE (NOW PROPERLY USED) ---------- */
  const confidence = Math.min(
    1,
    leadScore * 0.6 + (highIntent ? 0.3 : 0.1)
  );

  /* ---------- SIGNALS ---------- */
  const signals = computeExecutionSignals({
    stage,
    leadScore,
    highIntent,
    message,
    confidence,
  });

  /* ---------- CONTEXT QUALITY ---------- */
  const hasSufficientContext =
    message.length > 12 || highIntent || intentType === "problem";

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
