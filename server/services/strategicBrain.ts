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

function detectStage(
  message: string,
  intentType?: string
): BrainContext["stage"] {
  if (intentType === "greeting") return "greeting";
  if (intentType === "booking") return "conversion";
  if (intentType === "service_inquiry") return "service";
  if (intentType === "problem") return "strategy";

  if (/(hire|book|schedule|call|start|work with you)/i.test(message))
    return "conversion";

  if (/(price|cost|service|offer)/i.test(message)) return "service";

  if (/(how|improve|fix|scale|strategy)/i.test(message)) return "strategy";

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

  /* ---------- CONTEXT SHIFT FIX ---------- */
  const hasShift = detectContextShift(message, strategicMemory);
  if (hasShift) {
    strategicMemory = {}; // reset stale context
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

  /* ---------- LEAD SCORE (FIXED TYPE SAFE) ---------- */
  let leadScore = 0;
  try {
    const result = leadQualifier.scoreLead(sessionId || "anon", {});
    leadScore = Math.min(10, Math.max(0, result?.total || 0));
  } catch {
    leadScore = 0;
  }

  /* ---------- STAGE ---------- */
  const stage = detectStage(message, intentType);

  /* ---------- EXECUTION MODE ---------- */
  const executionMode =
    highIntent ||
    stage === "conversion" ||
    leadScore >= 7 ||
    /(start|do it|help|fix this now)/i.test(message)
      ? "execution"
      : "exploration";

  /* ---------- CONTEXT QUALITY ---------- */
  const hasSufficientContext =
    message.length > 15 ||
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
