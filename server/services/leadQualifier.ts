import { memoryService } from "./memoryService.js";
import type { StrategicMemory } from "./memoryService.js";

/* ================= TYPES ================= */
export type Stage =
  | "greeting"
  | "discovery"
  | "strategy"
  | "service"
  | "conversion";

export interface LeadScore {
  budget?: number;
  authority?: number;
  need?: number;
  timeline?: number;
  total: number;
  stage?: Stage;
}

type WeightSet = {
  budget: number;
  authority: number;
  need: number;
  timeline: number;
};

/* ================= UTILS ================= */
function clamp(val?: number): number {
  if (val === undefined || val === null || isNaN(val)) return 0;
  return Math.max(0, Math.min(1, val));
}

function normalizeStage(stage?: string): Stage {
  const allowed: Stage[] = ["greeting", "discovery", "strategy", "service", "conversion"];
  if (stage && allowed.includes(stage as Stage)) return stage as Stage;
  return "discovery";
}

/* 🔥 STRICT WEIGHT NORMALIZER (FIXED) */
function normalizeWeights(weights: WeightSet): WeightSet {
  const sum =
    weights.budget +
    weights.authority +
    weights.need +
    weights.timeline || 1;

  return {
    budget: weights.budget / sum,
    authority: weights.authority / sum,
    need: weights.need / sum,
    timeline: weights.timeline / sum,
  };
}

/* ================= CLASS ================= */
export class LeadQualifier {
  private baseWeights: WeightSet = {
    budget: 0.25,
    authority: 0.25,
    need: 0.35,
    timeline: 0.15,
  };

  /* ================= SCORE LEAD ================= */
  scoreLead(
    sessionId: string,
    bantData: Partial<LeadScore>,
    stageInput?: string
  ): LeadScore {
    const stage = normalizeStage(stageInput);

    let weights: WeightSet = { ...this.baseWeights };

    /* ================= DYNAMIC WEIGHTS ================= */

    if (stage === "discovery") {
      weights.need += 0.1;
    }

    if (stage === "strategy") {
      weights.need += 0.1;
      weights.timeline += 0.05;
    }

    if (stage === "service") {
      weights.authority += 0.1;
    }

    if (stage === "conversion") {
      weights.budget += 0.1;
      weights.authority += 0.1;
    }

    // ✅ FIXED (strict type-safe normalization)
    weights = normalizeWeights(weights);

    const score: LeadScore = {
      budget: clamp(bantData.budget),
      authority: clamp(bantData.authority),
      need: clamp(bantData.need),
      timeline: clamp(bantData.timeline),
      total: 0,
      stage,
    };

    /* ================= BASE SCORE ================= */
    let total =
      (score.budget || 0) * weights.budget +
      (score.authority || 0) * weights.authority +
      (score.need || 0) * weights.need +
      (score.timeline || 0) * weights.timeline;

    /* ================= HIGH INTENT BOOST ================= */
    const highIntent =
      (score.need || 0) > 0.6 &&
      ((score.timeline || 0) > 0.5 || (score.authority || 0) > 0.5);

    if (highIntent) {
      total += 0.15;
    }

    /* ================= CONVERSION BOOST ================= */
    if (stage === "conversion") {
      total += 0.1;
    }

    score.total = clamp(total);

    /* ================= DEBUG ================= */
    if (process.env.DEBUG_MEMORY === "true") {
      console.log(`[LeadQualifier] ${sessionId} | stage=${stage} ->`, score);
    }

    /* ================= MEMORY UPDATE ================= */
    if (sessionId && score.total > 0) {
      this.safeUpdateLeadScore(sessionId, score).catch((err) =>
        console.warn("[LeadQualifier] async memory update failed:", err)
      );
    }

    return score;
  }

  /* ================= MEMORY UPDATE ================= */
  private async safeUpdateLeadScore(sessionId: string, score: LeadScore) {
    try {
      if (score.total <= 0) return;

      const memoryUpdate: Partial<StrategicMemory> = {
        leadScore: score.total,
        stage: score.stage,
        updatedAt: new Date().toISOString(),
        lastInteraction: Date.now(),
      };

      await memoryService.updateStrategicMemory(sessionId, memoryUpdate);

      if (process.env.DEBUG_MEMORY === "true") {
        console.log(
          `[LeadQualifier] leadScore=${score.total} saved for session ${sessionId}`
        );
      }
    } catch (err) {
      console.warn(`[LeadQualifier] Memory update failed (${sessionId}):`, err);
    }
  }
}

/* ================= SINGLETON ================= */
export const leadQualifier = new LeadQualifier();
