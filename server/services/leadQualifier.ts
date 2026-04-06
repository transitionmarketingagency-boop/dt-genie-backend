// server/services/leadQualifier.ts

import { memoryService } from "./memoryService.js";
import type { StrategicMemory } from "./memoryService.js";

/* ================= TYPES ================= */
export interface LeadScore {
  budget?: number;      // 0-1
  authority?: number;   // 0-1
  need?: number;        // 0-1
  timeline?: number;    // 0-1
  total: number;        // 0-1 normalized, weighted
  stage?: string;       // optional conversation stage
}

/* ================= UTILS ================= */
function clamp(val?: number): number {
  if (val === undefined || isNaN(val)) return 0;
  return Math.max(0, Math.min(1, val));
}

/* ================= CLASS ================= */
export class LeadQualifier {

  // Weighted BANT components (dynamic per stage)
  private defaultWeights = {
    budget: 0.25,
    authority: 0.25,
    need: 0.35,
    timeline: 0.15,
  };

  /* ================= SCORE LEAD ================= */
  scoreLead(
    sessionId: string,
    bantData: Partial<LeadScore>,
    stage: string = "initial"
  ): LeadScore {

    // Adjust weights dynamically by stage if needed
    const weights = { ...this.defaultWeights };
    if (stage === "early") weights.need += 0.1; // focus on need in early stage
    if (stage === "late") weights.budget += 0.1; // emphasize budget later

    const score: LeadScore = {
      budget: clamp(bantData.budget),
      authority: clamp(bantData.authority),
      need: clamp(bantData.need),
      timeline: clamp(bantData.timeline),
      total: 0,
      stage,
    };

    // Weighted total
    score.total =
      (score.budget || 0) * weights.budget +
      (score.authority || 0) * weights.authority +
      (score.need || 0) * weights.need +
      (score.timeline || 0) * weights.timeline;

    score.total = clamp(score.total);

    // ---------- DEBUG ----------
    if (process.env.DEBUG_MEMORY === "true") {
      console.log(`[LeadQualifier] ${sessionId} | stage=${stage} ->`, score);
    }

    // ---------- MEMORY UPDATE ----------
    if (sessionId && score.total > 0) {
      this.safeUpdateLeadScore(sessionId, score);
    }

    return score;
  }

  /* ================= SAFE MEMORY UPDATE ================= */
  private async safeUpdateLeadScore(sessionId: string, score: LeadScore) {
    try {
      // Skip zero scores
      if (score.total <= 0) return;

      await memoryService.updateStrategicMemory(sessionId, {
        leadScore: score.total,
        lastLeadStage: score.stage,
        lastLeadComponents: {
          budget: score.budget,
          authority: score.authority,
          need: score.need,
          timeline: score.timeline,
        },
      } as Partial<StrategicMemory>);

      if (process.env.DEBUG_MEMORY === "true") {
        console.log(`[LeadQualifier] leadScore=${score.total} saved for ${sessionId}`);
      }

    } catch (err) {
      console.warn(`[LeadQualifier] Memory update failed (${sessionId}):`, err);
    }
  }
}

/* ================= SINGLETON ================= */
export const leadQualifier = new LeadQualifier();
