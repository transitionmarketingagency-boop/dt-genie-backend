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

function isShortMessage(message: string) {
  return message.length < 8;
}

function isGreeting(message: string) {
  return /^(hi|hello|hey|yo)$/i.test(message);
}

/* ================= CONTEXT SHIFT (FIXED & STABILIZED) ================= */

function detectContextShift(
  message: string,
  memory: StrategicMemory
): boolean {
  const msg = normalize(message);

  const strongSignals = ["new business", "different business", "reset"];
  const weakSignals = ["i run", "we are", "my business", "my store"];

  const hasStrong = strongSignals.some((s) => msg.includes(s));
  const hasWeak = weakSignals.some((s) => msg.includes(s));

  const hasMemory =
    !!memory?.industry ||
    !!memory?.businessType ||
    (memory?.servicesDiscussed?.length ?? 0) > 0;

  // ❌ FIX: only reset on STRONG intent OR strong+clear context mismatch
  if (hasStrong) return true;

  // ❌ FIX: prevent false resets on normal statements like "my business does X"
  if (hasWeak && hasMemory && msg.length > 40) return true;

  return false;
}

/* ================= STAGE DETECTOR ================= */

function detectStage(
  message: string,
  intentType?: string
): BrainContext["stage"] {
  const msg = normalize(message);

  if (intentType === "greeting") return "greeting";
  if (intentType === "booking") return "conversion";
  if (intentType === "service_inquiry") return "service";
  if (intentType === "problem") return "strategy";

  if (/(hire|book|start|work with you|get started)/i.test(msg))
    return "conversion";

  if (/(price|cost|service|offer)/i.test(msg)) return "service";

  if (/(how|fix|improve|scale|grow|increase)/i.test(msg))
    return "strategy";

  return "discovery";
}

/* ================= EXECUTION LOGIC (STABILIZED) ================= */

function computeExecutionSignals(params: {
  stage: BrainContext["stage"];
  leadScore: number;
  highIntent: boolean;
  message: string;
}) {
  const { stage, leadScore, highIntent, message } = params;

  const shortMsg = isShortMessage(message);

  // ❌ FIX: prevent unstable execution mode flips from neuralBrain noise
  const safeHighIntent = highIntent && message.length > 10;

  const executionMode: ExecutionMode =
    safeHighIntent && !shortMsg
      ? "execution"
      : leadScore >= 0.75 && stage !== "greeting"
      ? "execution"
      : "exploration";

  const shouldGiveCTA =
    !shortMsg &&
    (safeHighIntent ||
      (leadScore >= 0.78 && stage !== "discovery") ||
      stage === "conversion");

  const shouldAskQuestion =
    !shortMsg &&
    stage === "discovery" &&
    leadScore < 0.6 &&
    !safeHighIntent;

  const confidenceLevel = Math.min(
    1,
    leadScore * 0.75 + (safeHighIntent ? 0.25 : 0)
  );

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

  /* ---------- INTENT (STABILIZED) ---------- */
  let intent: any = {};

  try {
    const rawIntent = neuralBrain?.(message) || {};

    // ❌ FIX: sanitize unstable neural outputs
    intent = {
      type: typeof rawIntent?.type === "string" ? rawIntent.type : "general",
      highIntent: Boolean(rawIntent?.highIntent),
    };
  } catch {
    intent = { type: "general", highIntent: false };
  }

  const intentType = intent.type;
  const highIntent = Boolean(intent.highIntent);

  /* ---------- LEAD SCORE (STABILIZED) ---------- */
  let leadScore = 0;

  try {
    const scoreResult = leadQualifier?.scoreLead?.(
      sessionId || "anon",
      {
        need: intentType === "problem" ? 0.6 : 0.3,
        authority: highIntent ? 0.8 : 0.3,
      }
    );

    leadScore = Number(scoreResult?.total ?? 0);

    // ❌ FIX: clamp invalid values
    if (isNaN(leadScore) || leadScore < 0) leadScore = 0;
    if (leadScore > 1) leadScore = 1;
  } catch {
    leadScore = 0;
  }

  /* ---------- STAGE ---------- */
  const stage = isGreeting(message)
    ? "greeting"
    : detectStage(message, intentType);

  /* ---------- SIGNALS ---------- */
  const signals = computeExecutionSignals({
    stage,
    leadScore,
    highIntent,
    message,
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
