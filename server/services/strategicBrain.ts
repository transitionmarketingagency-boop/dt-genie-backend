// server/services/strategicBrain.ts
import { getRelevantIntents } from "./intentManager.js";
import { getFusedChunks } from "./intentVectorFusion.js";
import { memoryService } from "./memoryService.js";
import { leadQualifier } from "./leadQualifier.js";
import { reasoningEngine } from "./reasoningEngine.js";
import { detectMultipleServices, detectIntents } from "./serviceDetector.js";

/* ================= TYPES ================= */
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
  strategicMemory?: any;
  detectedServices?: string[];
};

/* ================= TEXT NORMALIZER ================= */
function normalizeText(text: string) {
  let t = (text || "").toLowerCase();
  const corrections: Record<string, string> = {
    schedual: "schedule",
    shedule: "schedule",
    bok: "book",
    cal: "call",
  };
  for (const wrong in corrections) {
    const regex = new RegExp(`\\b${wrong}\\b`, "g");
    t = t.replace(regex, corrections[wrong]);
  }
  return t.trim();
}

/* ================= GREETING DETECTOR ================= */
function isGreeting(text: string) {
  const greetings = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"];
  const lower = text.trim();
  return greetings.some((g) => lower === g || lower.startsWith(g + " "));
}

/* ================= BUSINESS SIGNAL DETECTOR ================= */
function detectBusinessSignals(text: string) {
  let signals = 0;
  const keywords = [
    "company","business","startup","agency","brand","store",
    "ecommerce","clients","revenue","real estate","team","marketing agency"
  ];
  for (const k of keywords) {
    if (text.includes(k)) signals++;
  }
  return Math.min(signals, 4);
}

/* ================= STAGE DETECTION ================= */
function detectStage(message: string): BrainContext["stage"] {
  const text = message;
  if (isGreeting(text)) return "greeting";
  if (["book","schedule","call","hire","consultation"].some(w => text.includes(w))) return "conversion";
  if (["price","cost","package","service"].some(w => text.includes(w))) return "service";
  if (["how","strategy","grow","scale","improve"].some(w => text.includes(w))) return "strategy";
  return "discovery";
}

/* ================= LEAD SCORING ================= */
function scoreLead(message: string) {
  const text = message;
  let score = detectBusinessSignals(text);

  if (text.includes("seo")) score += 2;
  if (text.includes("ads")) score += 2;
  if (text.includes("automation")) score += 2;
  if (text.includes("ai")) score += 1;

  if (text.includes("hire") || text.includes("agency")) score += 3;
  if (text.includes("price") || text.includes("cost") || text.includes("budget")) score += 3;
  if (text.includes("need") || text.includes("looking for")) score += 2;

  return Math.min(score, 10);
}

/* ================= DEAL PROBABILITY ================= */
function estimateDealProbability(stage: BrainContext["stage"], leadScore: number) {
  let probability = 0.1;
  if (stage === "discovery") probability = 0.25;
  if (stage === "strategy") probability = 0.45;
  if (stage === "service") probability = 0.7;
  if (stage === "conversion") probability = 0.9;
  probability += leadScore * 0.025;
  return Math.min(probability, 0.95);
}

/* ================= BOOKING TRIGGER ================= */
function shouldTriggerBooking(stage: BrainContext["stage"], leadScore: number) {
  if (stage === "conversion") return true;
  if (stage === "service" && leadScore >= 7) return true;
  if (stage === "strategy" && leadScore >= 9) return true;
  return false;
}

/* ================= FALLBACK REASONING (DYNAMIC) ================= */
function generateReasoning(
  message: string,
  detectedServices: { value: string; confidence: number }[]
) {
  if (detectedServices && detectedServices.length > 0) {
    const topService = [...detectedServices].sort((a, b) => b.confidence - a.confidence)[0].value;
    return `User is interested in ${topService}`;
  }

  const text = message;
  if (text.includes("grow")) return "User wants business growth strategy";
  if (text.includes("ads")) return "User is interested in advertising solutions";
  if (text.includes("seo")) return "User is exploring search optimization";
  if (text.includes("automation")) return "User is exploring AI automation";
  return "General marketing inquiry";
}

/* ================= DYNAMIC SERVICE RECOMMENDER ================= */
function pickRecommendedService(detectedServices: { value: string; confidence: number }[]) {
  if (!detectedServices || detectedServices.length === 0) return "general";
  return [...detectedServices].sort((a, b) => b.confidence - a.confidence)[0].value;
}

/* ================= MAIN STRATEGIC BRAIN ================= */
export async function strategicBrain(userMessage: string, sessionId?: string) {
  const normalizedMessage = normalizeText(userMessage);

  // Intent detection
  const intents = getRelevantIntents(normalizedMessage, 1);
  const primaryIntent = intents.length > 0 ? intents[0].intent.name : "general";

  // Stage detection & lead scoring
  const stage = detectStage(normalizedMessage);
  let leadScore = scoreLead(normalizedMessage);

  // Memory integration
  let strategicMemory: any = {};
  if (sessionId) {
    try {
      strategicMemory = await memoryService.getStrategicMemory(sessionId);
      if (strategicMemory?.servicesDiscussed?.length) leadScore += 1;
      if (strategicMemory?.businessMentioned) leadScore += 1;
    } catch {
      strategicMemory = {};
    }
  }
  leadScore = Math.min(leadScore, 10);

  // Lead qualifier update
  if (sessionId) {
    try {
      leadQualifier.scoreLead(sessionId, { need: leadScore / 10 });
    } catch {}
  }

  // Deal probability
  const dealProbability = estimateDealProbability(stage, leadScore);

  // Service detection (dynamic)
  const detectedServices = detectIntents(normalizedMessage)
    .filter(i => i.type === "service")
    .map(i => ({ value: i.value, confidence: i.confidence }));

  const recommendedService = pickRecommendedService(detectedServices);

  // Booking trigger
  const triggerBooking = shouldTriggerBooking(stage, leadScore);

  // Reasoning (UPDATED HERE)
  let reasoning = generateReasoning(normalizedMessage, detectedServices);

  if (sessionId) {
    try {
      const reasoningData = await reasoningEngine.analyze(sessionId, normalizedMessage);
      reasoning = reasoningData?.strategy || reasoning;
    } catch {}
  }

  // Fetch fused chunks
  const chunks = await getFusedChunks(normalizedMessage, 5);

  // STRICT CONTACT SANITIZATION (FIXED)
  const sanitizedChunks = chunks.filter(
    c =>
      !/(contact|email|phone|call me|reach me|@|www\.|http)/i.test(c.text)
  );

  // Recent context
  let recentContext: any[] = [];
  if (sessionId) {
    try {
      recentContext = await memoryService.getRecentContext(sessionId);
    } catch {
      recentContext = [];
    }
  }

  const brainContext: BrainContext = {
    message: userMessage,
    intent: primaryIntent,
    stage,
    leadScore,
    dealProbability,
    recommendedService,
    triggerBooking,
    reasoning,
    recentContext: recentContext.map((m: any) => ({
      role: m.role,
      content: m.content
    })),
    strategicMemory,
    detectedServices: detectedServices.map(d => d.value)
  };

  return {
    brainContext,
    chunks: sanitizedChunks
  };
}
