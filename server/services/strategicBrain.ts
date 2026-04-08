import { memoryService } from "./memoryService.js";
import { leadQualifier } from "./leadQualifier.js";

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
};

/* ================= HELPERS ================= */
function normalize(text: string) {
  return (text || "").toLowerCase().trim();
}

function isGreeting(msg: string) {
  return /^(hi|hello|hey|yo|whats up|what's up)$/.test(msg);
}

function detectStage(message: string): BrainContext["stage"] {
  if (isGreeting(message)) return "greeting";
  if (/(hire|book|schedule|call|start)/i.test(message)) return "conversion";
  if (/(price|cost|service)/i.test(message)) return "service";
  if (/(how|improve|fix|strategy)/i.test(message)) return "strategy";
  return "discovery";
}

/* ================= MAIN ================= */
export async function strategicBrain(userMessage: string, sessionId?: string) {
  const message = normalize(userMessage);

  // ---------- MEMORY ----------
  let strategicMemory: StrategicMemory = {};
  if (sessionId) {
    try {
      strategicMemory = (await memoryService.getStrategicMemory(sessionId)) || {};
    } catch {
      strategicMemory = {};
    }
  }

  // ---------- EARLY EXIT (CRITICAL FIX) ----------
  if (message.length < 8 || isGreeting(message)) {
    return {
      brainContext: {
        message: userMessage,
        stage: "greeting",
        leadScore: 0,
        detectedServices: [],
        executionMode: "exploration",
        hasSufficientContext: false,
      },
      chunks: [],
    };
  }

  // ---------- LEAD SCORE ----------
  let leadScore = 0;
  try {
    const result = leadQualifier.scoreLead(sessionId || "anon", {});
    leadScore = result.total * 10;
  } catch {
    leadScore = 0;
  }

  // ---------- STAGE ----------
  const stage = detectStage(message);

  // ---------- EXECUTION MODE ----------
  const executionMode =
    stage === "conversion" || leadScore > 6 ? "execution" : "exploration";

  // ---------- CONTEXT ----------
  const hasSufficientContext = message.length > 15;

  // ---------- RETURN CLEAN CONTEXT ----------
  return {
    brainContext: {
      message: userMessage,
      stage,
      leadScore,
      detectedServices: strategicMemory.servicesDiscussed || [],
      executionMode,
      hasSufficientContext,
    },
    chunks: [],
  };
}
