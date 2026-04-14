import { memoryService } from "./memoryService.js";
import { leadQualifier } from "./leadQualifier.js";
import { neuralBrain } from "./neuralBrain.js";

/* ================= TYPES ================= */
export type StrategicMemory = {
  servicesDiscussed?: string[];
  industry?: string;
  businessType?: string;
  lastInteraction?: number;
};

export type BrainContext = {
  message: string;
  stage: "greeting" | "discovery" | "strategy" | "service" | "conversion";
  leadScore: number;
  detectedServices?: string[];
  executionMode?: "execution" | "exploration";
  hasSufficientContext?: boolean;
  intentType?: string;
  highIntent?: boolean;
};

/* ================= HELPERS ================= */
function normalize(text: string) {
  return (text || "").toLowerCase().trim();
}

function detectContextShift(message: string, memory: StrategicMemory): boolean {
  if (!memory?.industry && !memory?.businessType) return false;

  const shiftSignals = ["i run", "i have", "my business", "my store", "we are"];

  return shiftSignals.some((s) => message.includes(s));
}

/* ================= STAGE DETECTION ================= */
function detectStage(message: string, intentType?: string): BrainContext["stage"] {
  const msg = message.toLowerCase();

  if (intentType === "greeting") return "greeting";
  if (intentType === "booking") return "conversion";
  if (intentType === "service_inquiry") return "service";
  if (intentType === "problem") return "strategy";

  if (/(hire|book|schedule|call|start|work with you|let's start)/i.test(msg))
    return "conversion";

  if (/(price|cost|service|offer|what do you do)/i.test(msg))
    return "service";

  if (/(how|improve|fix|scale|strategy|optimize)/i.test(msg))
    return "strategy";

  return "discovery";
}

/* ================= MAIN ================= */
export async function strategicBrain(
  userMessage: string,
  sessionId?: string
) {
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

  /* ---------- CONTEXT SHIFT (SAFE RESET) ---------- */
  const hasShift = detectContextShift(message, strategicMemory);

  if (hasShift && message.length > 20) {
    strategicMemory = {}; // reset ONLY when strong signal + enough context
  }

  /* ---------- NEURAL INTENT ---------- */
  let intent: any = {};
  try {
    intent = neuralBrain(message) || {};
  } catch {
    intent = { type: "general", highIntent: false };
  }

  const intentType = intent?.type || "general";
  const highIntent = Boolean(intent?.highIntent);

  /* ---------- LEAD SCORE (FIXED) ---------- */
  let leadScore = 0;

  try {
    const scoreResult = leadQualifier.scoreLead(sessionId || "anon", {
      // optional safety fallback (no empty object blind scoring)
      need: intentType === "problem" ? 0.5 : 0.2,
      authority: highIntent ? 0.6 : 0.2,
    });

    leadScore = Number(scoreResult?.total || 0);
  } catch {
    leadScore = 0;
  }

  /* ---------- STAGE ---------- */
  const stage = detectStage(message, intentType);

  /* ---------- EXECUTION MODE (FIXED LOGIC) ---------- */
  const executionMode =
    highIntent ||
    stage === "conversion" ||
    leadScore >= 0.6 ||
    (intentType === "problem" && message.length > 20)
      ? "execution"
      : "exploration";

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
      executionMode,
      hasSufficientContext,
      intentType,
      highIntent,
    },
    chunks: [],
  };
}
