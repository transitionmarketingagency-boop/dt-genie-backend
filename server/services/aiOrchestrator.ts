/* =====================================================
   NEON VISION / DT-GENIE AI ORCHESTRATION MODULE
   Combines Intent Detection, Service Suggestions,
   Lead Qualification, and Strategic Reasoning
===================================================== */

import { leadQualifier, type LeadScore } from "./leadQualifier.js";
import { reasoningEngine, type ReasoningData } from "./reasoningEngine.js";
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
  strategy: ReasoningData;
}

/* ======================= SERVICE DETECTOR ======================= */
export function detectServicesFromIntents(
  intentsDetected: { intent: Intent; score: number }[]
): ServiceRecommendation[] {
  const services: ServiceRecommendation[] = [];

  for (const item of intentsDetected) {
    if (item.intent.type === "service") {
      services.push({
        service: item.intent.name,
        confidence: item.score,
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

  /* ---------- 1️⃣ INTENT DETECTION ---------- */
  const detectedIntents = getRelevantIntents(message, [], 5);

  /* ---------- 2️⃣ SERVICE DETECTION ---------- */
  const recommendedServices = detectServicesFromIntents(detectedIntents);

  /* ---------- 3️⃣ LEAD SCORING (FIXED: AWAIT) ---------- */
  const leadScore = await leadQualifier.scoreLead(
    sessionId,
    {
      budget: detectedIntents.some(i => i.intent.name === "hire_intent") ? 1 : undefined,
      authority: detectedIntents.some(i => i.intent.type === "buying") ? 1 : undefined,
      need: recommendedServices.length > 0 ? 1 : 0,
      timeline: detectedIntents.some(i => i.intent.name === "hire_intent") ? 1 : 0,
    },
    "discovery" // safe default stage
  );

  /* ---------- 4️⃣ STRATEGIC REASONING ---------- */
  const strategy = await reasoningEngine.analyze(sessionId, message);

  /* ---------- FINAL RETURN ---------- */
  return {
    intents: detectedIntents,
    recommendedServices,
    leadScore,
    strategy,
  };
}

/* ======================= SINGLETON ======================= */
export const aiOrchestrator = {
  processUserMessage,
  detectServicesFromIntents,
};
