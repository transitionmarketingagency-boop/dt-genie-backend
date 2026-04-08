/* =====================================================
   NEON VISION / DT-GENIE AI ORCHESTRATION MODULE
   Clean Version (NO HARDCODED REASONING)
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
  // ❌ removed ReasoningData completely
}

/* ======================= SERVICE DETECTOR ======================= */
export function detectServicesFromIntents(
  intentsDetected: { intent: Intent; score: number }[]
): ServiceRecommendation[] {
  const services: ServiceRecommendation[] = [];

  for (const item of intentsDetected) {
    if (item.intent?.type === "service") {
      services.push({
        service: item.intent.name,
        confidence: item.score ?? 0,
      });
    }
  }

  return services.sort((a, b) => b.confidence - a.confidence);
}

/* ======================= ORCHESTRATION ======================= */
export async function processUserMessage(
  sessionId: string,
  message: string
): Promise<OrchestratorResult> {
  // ---------- 1️⃣ INTENT DETECTION ----------
  let detectedIntents: { intent: Intent; score: number }[] = [];
  try {
    detectedIntents = getRelevantIntents(message, [], 5) || [];
  } catch (err) {
    console.warn("Intent detection failed:", err);
    detectedIntents = [];
  }

  // ---------- 2️⃣ SERVICE DETECTION ----------
  let recommendedServices: ServiceRecommendation[] = [];
  try {
    recommendedServices = detectServicesFromIntents(detectedIntents);
  } catch (err) {
    console.warn("Service detection failed:", err);
    recommendedServices = [];
  }

  // ---------- 3️⃣ LEAD SCORING ----------
  let leadScore: LeadScore = {
    total: 0,
    budget: 0,
    authority: 0,
    need: 0,
    timeline: 0,
  };

  try {
    leadScore = await leadQualifier.scoreLead(
      sessionId,
      {
        budget: detectedIntents.some((i) => i.intent.name === "hire_intent") ? 1 : undefined,
        authority: detectedIntents.some((i) => i.intent.type === "buying") ? 1 : undefined,
        need: recommendedServices.length > 0 ? 1 : 0,
        timeline: detectedIntents.some((i) => i.intent.name === "hire_intent") ? 1 : 0,
      },
      "discovery"
    );
  } catch (err) {
    console.warn("Lead scoring failed:", err);
  }

  // ✅ NO REASONING — LET LLM HANDLE IT

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
