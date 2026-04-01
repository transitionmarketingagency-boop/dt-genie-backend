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
  cachedFusedChunks?: any[];
  cachedReasoning?: string;
  [key: string]: any;
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
  t = t.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  return t;
}

/* ================= GREETING DETECTOR ================= */
function isGreeting(text: string) {
  const greetings = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"];
  const lower = text.trim();
  return greetings.some((g) => lower === g || lower.startsWith(g + " "));
}

/* ================= DYNAMIC GREETING ================= */
function generateDynamicGreeting(sessionMemory?: StrategicMemory) {
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
  let score = detectBusinessSignals(message);
  if (/\bseo\b/.test(message)) score += 2;
  if (/\bads\b/.test(message)) score += 2;
  if (/\bautomation\b/.test(message)) score += 2;
  if (/\bai\b/.test(message)) score += 1;
  if (message.includes("hire") || message.includes("agency")) score += 3;
  if (message.includes("price") || message.includes("cost") || message.includes("budget")) score += 3;
  if (message.includes("need") || message.includes("looking for")) score += 2;
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
): string {
  try {
    if (detectedServices?.length) {
      const topService = [...detectedServices].sort((a, b) => b.confidence - a.confidence)[0].value;
      return `User is interested in ${topService}`;
    }
    if (message.includes("grow")) return "User wants business growth strategy";
    if (message.includes("ads")) return "User is interested in advertising solutions";
    if (message.includes("seo")) return "User is exploring search optimization";
    if (message.includes("automation")) return "User is exploring AI automation";
    return "General marketing inquiry";
  } catch {
    return "General marketing inquiry";
  }
}

/* ================= SERVICE RECOMMENDER ================= */
function pickRecommendedService(detectedServices: { value: string; confidence: number }[]) {
  if (!detectedServices?.length) return "general";
  return [...detectedServices].sort((a, b) => b.confidence - a.confidence)[0].value;
}

/* ================= UNIFIED INTENT RANKING ================= */
function mergeIntentScores(
  primaryIntent: string,
  intentScore: number,
  detectedServices: { value: string; confidence: number }[],
  reasoning: string
) {
  const ranking: { intent: string; score: number }[] = [];
  ranking.push({ intent: primaryIntent, score: intentScore });
  for (const s of detectedServices) ranking.push({ intent: s.value, score: s.confidence * 0.9 + 0.1 });
  if (reasoning && !ranking.some(r => r.intent === reasoning)) ranking.push({ intent: reasoning, score: 0.5 });
  ranking.sort((a, b) => b.score - a.score);
  return ranking;
}

/* ================= MAIN STRATEGIC BRAIN ================= */
export async function strategicBrain(userMessage: string, sessionId?: string) {
  const normalizedMessage = normalizeText(userMessage);
  const stage = detectStage(normalizedMessage);
  let leadScore = scoreLead(normalizedMessage);

  let primaryIntent = "general";
  let primaryIntentScore = 0.6;
  try {
    const intents = getRelevantIntents(normalizedMessage, 1);
    if (intents.length > 0) {
      primaryIntent = intents[0].intent.name;
      primaryIntentScore = intents[0].score ?? 0.6;
    }
  } catch {}

  // ---------------- MEMORY & CACHING ----------------
  const strategicMemory: StrategicMemory = sessionId
    ? await memoryService.getStrategicMemory(sessionId).catch(() => ({}))
    : {};

  // Detect services
  let detectedServices: { value: string; confidence: number }[] = [];
  try {
    detectedServices = detectIntents(normalizedMessage)
      .filter((i: any) => i.type === "service")
      .map((i: any) => ({ value: i.value, confidence: i.confidence }));
  } catch {}

  // Fused Chunks
  let fusedChunks = strategicMemory.cachedFusedChunks ?? [];
  if (!fusedChunks.length) {
    fusedChunks = await getFusedChunks(normalizedMessage, 5).catch(() => []);
    strategicMemory.cachedFusedChunks = fusedChunks;
  }

  // Reasoning
  let reasoning: string = strategicMemory.cachedReasoning ?? "";
  if (!reasoning) {
    try {
      const reasoningData: any = sessionId
        ? await reasoningEngine.analyze(sessionId, normalizedMessage)
        : {};
      reasoning = reasoningData?.strategy ?? generateReasoning(normalizedMessage, detectedServices);
    } catch {
      reasoning = generateReasoning(normalizedMessage, detectedServices);
    }
    strategicMemory.cachedReasoning = reasoning;
  }

  // Adjust leads
  if (strategicMemory.servicesDiscussed?.length) leadScore += 1;
  if (strategicMemory.businessMentioned) leadScore += 1;
  leadScore = Math.min(leadScore, 10);

  // Track lead
  if (sessionId) {
    try { leadQualifier.scoreLead(sessionId, { need: leadScore / 10 }); } catch {}
  }

  const dealProbability = estimateDealProbability(stage, leadScore);
  const recommendedService = pickRecommendedService(detectedServices);
  const triggerBooking = shouldTriggerBooking(stage, leadScore);
  const dynamicGreeting = stage === "greeting" ? generateDynamicGreeting(strategicMemory) : undefined;
  const unifiedIntentRanking = mergeIntentScores(primaryIntent, primaryIntentScore, detectedServices, reasoning);

  const recentContext = sessionId
    ? await memoryService.getRecentContext(sessionId).catch(() => [])
    : [];

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
    dynamicGreeting,
    unifiedIntentRanking
  };

  // Clean fused chunks
  fusedChunks = (fusedChunks || []).filter(
    (c: any) => c?.text && !/(contact|email|phone|call me|reach me|@|www\.|http)/i.test(c.text)
  );

  return { brainContext, chunks: fusedChunks };
}
