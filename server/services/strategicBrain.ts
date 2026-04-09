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

function detectStage(message: string, intentType?: string): BrainContext["stage"] {
  if (intentType === "greeting") return "greeting";
  if (intentType === "booking") return "conversion";
  if (intentType === "service_inquiry") return "service";
  if (intentType === "problem") return "strategy";

  if (/(hire|book|schedule|call|start)/i.test(message)) return "conversion";
  if (/(price|cost|service)/i.test(message)) return "service";
  if (/(how|improve|fix|strategy)/i.test(message)) return "strategy";

  return "discovery";
}

/* ================= MAIN ================= */
export async function strategicBrain(userMessage: string, sessionId?: string) {
  const message = normalize(userMessage);

  /* ---------- MEMORY ---------- */
  let strategicMemory: StrategicMemory = {};
  if (sessionId) {
    try {
      strategicMemory = (await memoryService.getStrategicMemory(sessionId)) || {};
    } catch {
      strategicMemory = {};
    }
  }

  /* ---------- NEURAL INTENT (CRITICAL FIX) ---------- */
  const intent = neuralBrain(message);

  /* ---------- LEAD SCORE ---------- */
  let leadScore = 0;
  try {
    const result = leadQualifier.scoreLead(sessionId || "anon", {});
    leadScore = (result.total || 0) * 10;
  } catch {
    leadScore = 0;
  }

  /* ---------- STAGE ---------- */
  const stage = detectStage(message, intent.type);

  /* ---------- EXECUTION MODE ---------- */
  const executionMode =
    intent.highIntent || leadScore > 6 || stage === "conversion"
      ? "execution"
      : "exploration";

  /* ---------- CONTEXT QUALITY ---------- */
  const hasSufficientContext =
    message.length > 12 ||
    intent.type === "problem" ||
    intent.type === "service_inquiry";

  /* ---------- RETURN STRONG CONTEXT ---------- */
  return {
    brainContext: {
      message: userMessage,
      stage,
      leadScore,
      detectedServices: strategicMemory.servicesDiscussed || [],
      executionMode,
      hasSufficientContext,
      intentType: intent.type,
      highIntent: intent.highIntent,
    },
    chunks: [],
  };
}
