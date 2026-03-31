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
  dynamicGreeting?: string;
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

/* ================= DYNAMIC SMART GREETING ================= */
function generateDynamicGreeting(sessionMemory?: any) {
  const now = new Date();
  const hour = now.getHours();
  let baseGreeting = "Hello";

  if (hour >= 5 && hour < 12) baseGreeting = "Good morning";
  else if (hour >= 12 && hour < 17) baseGreeting = "Good afternoon";
  else if (hour >= 17 && hour < 22) baseGreeting = "Good evening";
  else baseGreeting = "Hi";

  const variations = [
    `${baseGreeting}! How’s your day going?`,
    `${baseGreeting}! Ready to grow your business today?`,
    `${baseGreeting}! What marketing goals are we tackling?`,
    `${baseGreeting}! Let’s talk strategy for your brand.`,
  ];

  const index = sessionMemory?.greetingIndex
    ? (sessionMemory.greetingIndex + 1) % variations.length
    : 0;
  if (sessionMemory) sessionMemory.greetingIndex = index;

  return variations[index];
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
  const text = message.toLowerCase();
  if (isGreeting(text) && text.split(" ").length <= 3) return "greeting";
  if (/(book|schedule|call|hire|consultation)/.test(text)) return "conversion";
  if (/(price|cost|package|service|how much)/.test(text)) return "service";
  if (/(strategy|plan|approach|how do i|how to)/.test(text)) return "strategy";
  return "discovery";
}

/* ================= LEAD SCORING ================= */
function scoreLead(message: string) {
  const text = message;
  let score = detectBusinessSignals(text);

  if (/\bseo\b/.test(text)) score += 2;
  if (/\bads\b/.test(text)) score += 2;
  if (/\bautomation\b/.test(text)) score += 2;
  if (/\bai\b/.test(text)) score += 1;

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

/* ================= FALLBACK REASONING ================= */
function generateReasoning(
  message: string,
  detectedServices: { value: string; confidence: number }[]
) {
  try {
    if (detectedServices?.length) {
      const topService = [...detectedServices].sort((a, b) => b.confidence - a.confidence)[0].value;
      return `User is interested in ${topService}`;
    }

    const text = message;
    if (text.includes("grow")) return "User wants business growth strategy";
    if (text.includes("ads")) return "User is interested in advertising solutions";
    if (text.includes("seo")) return "User is exploring search optimization";
    if (text.includes("automation")) return "User is exploring AI automation";
    return "General marketing inquiry";
  } catch {
    return "General marketing inquiry"; 
  }
}

/* ================= SERVICE RECOMMENDER ================= */
function pickRecommendedService(detectedServices: { value: string; confidence: number }[]) {
  try {
    if (!detectedServices?.length) return "general";
    return [...detectedServices].sort((a, b) => b.confidence - a.confidence)[0].value;
  } catch {
    return "general";
  }
}

/* ================= MAIN STRATEGIC BRAIN ================= */
export async function strategicBrain(userMessage: string, sessionId?: string) {
  const normalizedMessage = normalizeText(userMessage);

  let primaryIntent = "general";
  try {
    const intents = getRelevantIntents(normalizedMessage, 1);
    if (intents.length > 0) primaryIntent = intents[0].intent.name;
  } catch {}

  const stage = detectStage(normalizedMessage);
  let leadScore = scoreLead(normalizedMessage);

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

  if (sessionId) {
    try {
      leadQualifier.scoreLead(sessionId, { need: leadScore / 10 });
    } catch {}
  }

  const dealProbability = estimateDealProbability(stage, leadScore);

  /* ===== SAFE SERVICE DETECTION ===== */
  let detectedServices: { value: string; confidence: number }[] = [];
  try {
    const detectedServicesRaw = detectIntents(normalizedMessage) || [];
    detectedServices = detectedServicesRaw
      .filter(i => i.type === "service")
      .map(i => ({ value: i.value, confidence: i.confidence }));
  } catch {
    detectedServices = [];
  }

  const recommendedService = pickRecommendedService(detectedServices);
  const triggerBooking = shouldTriggerBooking(stage, leadScore);

  let reasoning = generateReasoning(normalizedMessage, detectedServices);

  if (sessionId) {
    try {
      const reasoningData = await reasoningEngine.analyze(sessionId, normalizedMessage);
      reasoning = reasoningData?.strategy || reasoning;
    } catch {}
  }

  /* ===== SAFE CHUNK FUSION & SANITIZATION ===== */
  let chunks: any[] = [];
  try {
    const fusedChunks = await getFusedChunks(normalizedMessage, 5);
    chunks = (fusedChunks || []).filter(
      (c: any) => c?.text && !/(contact|email|phone|call me|reach me|@|www\.|http)/i.test(c.text)
    );
  } catch {
    chunks = [];
  }

  let recentContext: any[] = [];
  if (sessionId) {
    try {
      recentContext = await memoryService.getRecentContext(sessionId);
    } catch {
      recentContext = [];
    }
  }

  const dynamicGreeting = stage === "greeting" ? generateDynamicGreeting(strategicMemory) : undefined;

  const brainContext: BrainContext = {
    message: userMessage,
    intent: primaryIntent,
    stage,
    leadScore,
    dealProbability,
    recommendedService,
    triggerBooking,
    reasoning,
    recentContext: recentContext.map((m: any) => ({ role: m.role, content: m.content })),
    strategicMemory,
    detectedServices: detectedServices.map(d => d.value),
    dynamicGreeting
  };

  /* ===== FINAL ENFORCEMENT LAYERS ===== */
  brainContext.reasoning = brainContext.reasoning || "General marketing inquiry";
  brainContext.recommendedService = brainContext.recommendedService || "general";
  brainContext.detectedServices = brainContext.detectedServices?.length
    ? brainContext.detectedServices
    : ["general"];

  return {
    brainContext,
    chunks
  };
}
