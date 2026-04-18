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

/* ================= GREETING (STABILIZED) ================= */
function isGreeting(message: string) {
  const msg = message.trim().toLowerCase();
  return /^(hi|hello|hey|yo|hi there|hello there|hey there)\b/.test(msg);
}

function isShortMessage(message: string) {
  return message.length < 10; // 🔥 FIX: was too aggressive (8 → 10)
}

/* ================= CONTEXT SHIFT (SAFE MODE) ================= */
function detectContextShift(message: string, memory: StrategicMemory): boolean {
  const msg = message.toLowerCase();

  const strongSignals = [
    "new business",
    "different business",
    "reset",
    "start over",
    "completely new"
  ];

  const hasStrong = strongSignals.some((s) => msg.includes(s));

  const hasMemory =
    !!memory?.industry ||
    !!memory?.businessType ||
    (memory?.servicesDiscussed?.length ?? 0) > 0;

  // 🔥 FIX: only reset on STRONG explicit signal + existing memory
  return hasStrong && hasMemory;
}

/* ================= STAGE DETECTOR (STABLE) ================= */

function detectStage(
  message: string,
  intentType?: string
): BrainContext["stage"] {
  const msg = message.toLowerCase();

  if (intentType === "greeting") return "greeting";
  if (intentType === "booking") return "conversion";
  if (intentType === "service_inquiry") return "service";
  if (intentType === "problem") return "strategy";

  if (/(hire|book|start|work with you|get started|schedule)/i.test(msg))
    return "conversion";

  if (/(price|cost|service|offer|package|pricing)/i.test(msg))
    return "service";

  if (/(how|fix|improve|scale|grow|increase|optimize|boost)/i.test(msg))
    return "strategy";

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

  /* 🔥 FIX: STRICT execution gating (prevents spam execution mode) */
  const executionMode: ExecutionMode =
    highIntent && confidence >= 0.65 && !shortMsg
      ? "execution"
      : leadScore >= 0.8 && confidence >= 0.7 && stage !== "greeting"
      ? "execution"
      : "exploration";

  /* 🔥 FIX: CTA only when stable intent exists */
  const shouldGiveCTA =
    !shortMsg &&
    confidence >= 0.65 &&
    (highIntent || leadScore >= 0.82 || stage === "conversion");

  /* 🔥 FIX: avoid unnecessary questioning loops */
  const shouldAskQuestion =
    !shortMsg &&
    stage === "discovery" &&
    leadScore < 0.65 &&
    confidence < 0.6 &&
    !highIntent;

  return {
    executionMode,
    shouldGiveCTA,
    shouldAskQuestion,
    confidenceLevel: confidence,
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

  /* ---------- CONTEXT SHIFT ---------- */
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

  /* ---------- CONFIDENCE (SMOOTHED) ---------- */
  const confidence = Math.min(
    1,
    leadScore * 0.65 + (highIntent ? 0.25 : 0.1)
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
