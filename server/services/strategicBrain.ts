import { getRelevantIntents } from "./intentManager.js";
import { getFusedChunks } from "./intentVectorFusion.js";
import { memoryService } from "./memoryService.js";
import { leadQualifier } from "./leadQualifier.js";
import { reasoningEngine } from "./reasoningEngine.js";
import { detectIntents } from "./serviceDetector.js";

/* ================= TYPES ================= */
export type StrategicMemory = {
  servicesDiscussed?: string[];
  businessMentioned?: boolean;
  greetingIndex?: number;
  industry?: string;
  lastUserProblem?: string;
  lastService?: string;
  businessType?: string;
  lastInteraction?: number;
};

export type BrainContext = {
  message: string;
  intent?: string;
  stage: "greeting" | "discovery" | "strategy" | "service" | "conversion";
  leadScore: number;
  dealProbability?: number;
  recommendedService?: string | null;
  triggerBooking?: boolean;
  reasoning?: string;
  recentContext?: { role: string; content: string }[];
  strategicMemory?: StrategicMemory;
  detectedServices?: string[];
  dynamicGreeting?: string;
  unifiedIntentRanking?: { intent: string; score: number }[];
  executionMode?: "execution" | "exploration" | "action";
  highIntent?: boolean;
  hasSufficientContext?: boolean;
};

/* ================= HELPERS ================= */
function normalizeText(text: string) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGreeting(text: string) {
  return /^(hi|hello|hey)\b/i.test(text);
}

function detectStage(message: string, leadScore: number): BrainContext["stage"] {
  if (isGreeting(message) && leadScore < 0.5) return "greeting";
  if (/(hire|book|schedule|call|start|work with)/i.test(message)) return "conversion";
  if (/(price|cost|services|package)/i.test(message)) return "service";
  if (/(how|improve|optimize|strategy|fix)/i.test(message)) return "strategy";
  return "discovery";
}

function estimateDealProbability(stage: BrainContext["stage"], leadScore: number) {
  const base = {
    greeting: 0.1,
    discovery: 0.3,
    strategy: 0.5,
    service: 0.75,
    conversion: 0.9,
  };
  return Math.min(base[stage] + leadScore * 0.04, 0.98);
}

function isHighIntent(message: string, stage: BrainContext["stage"], leadScore: number) {
  return /(hire|book|schedule|start now|ready)/i.test(message) || stage === "conversion" || leadScore >= 7;
}

/* ================= MAIN ================= */
export async function strategicBrain(userMessage: string, sessionId?: string) {
  const message = normalizeText(userMessage);

  // ---------- Load Strategic Memory ----------
  let strategicMemory: StrategicMemory = {};
  let isFreshSession = true;

  if (sessionId) {
    try {
      strategicMemory = (await memoryService.getStrategicMemory(sessionId)) || {};
      const last = strategicMemory.lastInteraction ?? 0;
      isFreshSession = Date.now() - last > 1000 * 60 * 30; // 30 min freshness
      strategicMemory.lastInteraction = Date.now();
    } catch (err) {
      console.warn("Failed to load strategic memory:", err);
      strategicMemory = {};
    }
  }

  // ---------- LEAD SCORE ----------
  let leadScore = 0;
  if (!isFreshSession && sessionId) {
    try {
      const result = leadQualifier.scoreLead(sessionId, { need: 0.5 });
      leadScore = Math.min(result.total * 10, 10);
    } catch (err) {
      console.warn("Lead scoring failed:", err);
      leadScore = 0;
    }
  }

  // ---------- STAGE ----------
  const stage = detectStage(message, leadScore);
  let executionMode: BrainContext["executionMode"] = stage === "greeting" ? "exploration" : "execution";

  // ---------- INTENTS ----------
  let unifiedIntentRanking: { intent: string; score: number }[] = [];
  let primaryIntent = "general";
  try {
    const intents = getRelevantIntents(message, [], 5) || [];
    unifiedIntentRanking = intents.map((i) => ({ intent: i.intent?.name || "general", score: i.score || 0 }));
    if (intents.length && intents[0].intent?.name) primaryIntent = intents[0].intent.name;
  } catch (err) {
    console.warn("Intent extraction failed:", err);
  }

  // ---------- SERVICES ----------
  let detectedServices: string[] = [];
  try {
    const detected = (await detectIntents(message)) || [];
    detectedServices = detected
      .filter((i) => i.type === "service" && i.confidence > 0.5)
      .map((i) => i.value)
      .filter(Boolean);

    // Merge only if session is not fresh
    const existing = isFreshSession ? new Set<string>() : new Set(strategicMemory.servicesDiscussed || []);
    detectedServices.forEach((s) => existing.add(s));
    strategicMemory.servicesDiscussed = Array.from(existing);

    strategicMemory.lastService = detectedServices[0] || strategicMemory.lastService;
  } catch (err) {
    console.warn("Service detection failed:", err);
  }

  // ---------- CONTEXT ----------
  const hasBusinessContext = /(roas|ads|sales|conversion|seo|revenue|store|business)/i.test(message);
  const hasSufficientContext = message.length > 8 || (strategicMemory.servicesDiscussed?.length ?? 0) > 0;

  if (hasBusinessContext) {
    strategicMemory.businessMentioned = true;
    strategicMemory.lastUserProblem = message;
  }

  // ---------- DYNAMIC GREETING ----------
  let dynamicGreeting: string | undefined;
  if (stage === "greeting" && leadScore < 0.5) {
    dynamicGreeting = "Hey — what are you trying to improve right now?";
  }

  // ---------- REASONING ----------
  let reasoning = "";
  try {
    if (!dynamicGreeting && sessionId) {
      const result = await reasoningEngine.analyze(sessionId, message);
      reasoning = result?.strategy || "";

      if (detectedServices.length > 1) {
        const serviceFallbacks = detectedServices.map((s) => `Optimize ${s} with targeted tactics.`);
        reasoning += "\n\n" + serviceFallbacks.join("\n");
      }
    }
  } catch (err) {
    console.warn("Reasoning analysis failed:", err);
  }

  // ---------- Reasoning Fallback ----------
  if (!reasoning || reasoning.length < 20) {
    if (!dynamicGreeting) {
      reasoning =
        "Focus on identifying the exact bottleneck per service and optimize each layer: traffic, conversion, and offer alignment.";
    } else {
      reasoning = dynamicGreeting;
    }
  }

  // ---------- INTENT LEVEL ----------
  const highIntent = isHighIntent(message, stage, leadScore);
  if (highIntent) executionMode = "action";

  // ---------- SERVICE ----------
  const recommendedService = detectedServices[0] || strategicMemory.lastService || null;
  const triggerBooking = highIntent || (leadScore >= 6 && stage === "service");

  // ---------- RECENT CONTEXT ----------
  let recentContext: { role: string; content: string }[] = [];
  if (sessionId) {
    try {
      recentContext = (await memoryService.getRecentContext(sessionId))
        .filter(msg => {
          const ts = msg.timestamp instanceof Date ? msg.timestamp.getTime() : new Date(msg.timestamp).getTime();
          return Date.now() - ts < 1000 * 60 * 60; // last 1 hour
        })
        .map(msg => ({ role: msg.role, content: msg.content }));
    } catch (err) {
      console.warn("Recent context fetch failed:", err);
      recentContext = [];
    }
  }

// ---------- VECTOR CHUNKS ----------
let fusedChunks: any[] = [];
try {
  // Pass number of chunks instead of an object
  fusedChunks = await getFusedChunks(message, 3);
  fusedChunks = fusedChunks.filter((c) => c?.text && !/(contact|email|phone|http)/i.test(c.text));
} catch (err) {
  console.warn("Fused chunks failed:", err);
  fusedChunks = [];
}

  // ---------- SAVE MEMORY ----------
  if (sessionId) {
    try {
      await memoryService.updateStrategicMemory(sessionId, strategicMemory);
    } catch (err) {
      console.warn("Failed to update strategic memory:", err);
    }
  }

  // ---------- FINAL CONTEXT ----------
  const brainContext: BrainContext = {
    message: userMessage,
    intent: primaryIntent,
    stage,
    leadScore,
    dealProbability: estimateDealProbability(stage, leadScore),
    recommendedService,
    triggerBooking,
    reasoning,
    recentContext,
    strategicMemory,
    detectedServices,
    unifiedIntentRanking,
    executionMode,
    highIntent,
    hasSufficientContext,
    dynamicGreeting,
  };

  return { brainContext, chunks: fusedChunks };
}
