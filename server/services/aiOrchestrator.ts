/* =====================================================
   NEON VISION / DT-GENIE AI ORCHESTRATION MODULE
   FIXED + STABLE VERSION
===================================================== */

import { leadQualifier, type LeadScore } from "./leadQualifier.js";
import { getRelevantIntents, type Intent } from "./intentManager.js";

/* ======================= TYPES ======================= */
export interface ServiceRecommendation {
  service: string;
  confidence: number; // 0-1 score
}

export interface OrchestratorResult {
  intents: { intent: Intent; score: number }[];
  recommendedServices: ServiceRecommendation[];
  leadScore: LeadScore;
}

/* ======================= SERVICE DETECTOR (FIXED) ======================= */
export function detectServicesFromIntents(
  intentsDetected: { intent: Intent; score: number }[]
): ServiceRecommendation[] {
  const services: ServiceRecommendation[] = [];

  for (const item of intentsDetected) {
    const intent = item.intent;

    if (!intent) continue;

    // 🔥 improved detection (service OR high-value keyword match)
    const isService =
      intent.type === "service" ||
      intent.category === "service" ||
      intent.name.includes("service");

    if (isService) {
      services.push({
        service: intent.name,
        confidence: Math.min(Math.max(item.score || 0, 0), 1),
      });
    }
  }

  return services.sort((a, b) => b.confidence - a.confidence);
}

/* ======================= NORMALIZE INTENT SIGNALS ======================= */
function extractLeadSignals(intents: { intent: Intent; score: number }[]) {
  const signals = {
    hire: false,
    buying: false,
    serviceInterest: false,
  };

  for (const i of intents) {
    if (i.intent.name === "hire_intent") signals.hire = true;
    if (i.intent.type === "buying") signals.buying = true;
    if (i.intent.type === "service") signals.serviceInterest = true;
  }

  return signals;
}

/* ======================= ORCHESTRATION ======================= */
export async function processUserMessage(
  sessionId: string,
  message: string
): Promise<OrchestratorResult> {

  /* ---------- 1️⃣ INTENT DETECTION ---------- */
  let detectedIntents: { intent: Intent; score: number }[] = [];

  try {
    detectedIntents = getRelevantIntents(message, [], 5) || [];
  } catch (err) {
    console.warn("Intent detection failed:", err);
    detectedIntents = [];
  }

  // 🔥 ensure stability
  if (!Array.isArray(detectedIntents)) {
    detectedIntents = [];
  }

  /* ---------- 2️⃣ SERVICE DETECTION ---------- */
  let recommendedServices: ServiceRecommendation[] = [];

  try {
    recommendedServices = detectServicesFromIntents(detectedIntents);
  } catch (err) {
    console.warn("Service detection failed:", err);
    recommendedServices = [];
  }

  /* ---------- 3️⃣ SIGNAL EXTRACTION ---------- */
  const signals = extractLeadSignals(detectedIntents);

  /* ---------- 4️⃣ LEAD SCORING (FIXED SYNC USAGE) ---------- */
  let leadScore: LeadScore = {
    total: 0,
    budget: 0,
    authority: 0,
    need: 0,
    timeline: 0,
  };

  try {
    leadScore = leadQualifier.scoreLead(
      sessionId,
      {
        // 🔥 SAFE BANT SIGNALS
        budget: signals.hire ? 0.8 : 0,
        authority: signals.buying ? 0.7 : 0,
        need: signals.serviceInterest || recommendedServices.length > 0 ? 0.6 : 0,
        timeline: signals.hire ? 0.5 : 0,
      },
      "discovery"
    );
  } catch (err) {
    console.warn("Lead scoring failed:", err);
  }

  /* ---------- FINAL OUTPUT ---------- */
  return {
    intents: detectedIntents,
    recommendedServices,
    leadScore,
  };
}

/* ======================= SINGLETON ======================= */
export const aiOrchestrator = {
  processUserMessage,
  detectServicesFromIntents,
};
