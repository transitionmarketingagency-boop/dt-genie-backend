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
}

/* ================= UTILS ================= */
function clamp(val?: number): number {
  if (val === undefined || isNaN(val)) return 0;
  return Math.max(0, Math.min(1, val));
}

/* ================= CLASS ================= */
export class LeadQualifier {

  private weights = {
    budget: 0.25,
    authority: 0.25,
    need: 0.35,
    timeline: 0.15,
  };

  /* ================= SCORE LEAD ================= */
  scoreLead(sessionId: string, bantData: Partial<LeadScore>): LeadScore {

    const score: LeadScore = {
      budget: clamp(bantData.budget),
      authority: clamp(bantData.authority),
      need: clamp(bantData.need),
      timeline: clamp(bantData.timeline),
      total: 0,
    };

    /* ---------- SAFE WEIGHTED TOTAL ---------- */
    score.total =
      (score.budget || 0) * this.weights.budget +
      (score.authority || 0) * this.weights.authority +
      (score.need || 0) * this.weights.need +
      (score.timeline || 0) * this.weights.timeline;

    score.total = clamp(score.total);

    /* ---------- DEBUG ---------- */
    if (process.env.DEBUG_MEMORY === "true") {
      console.log(`[LeadQualifier] ${sessionId} ->`, score);
    }

    /* ---------- NON-BLOCKING MEMORY UPDATE ---------- */
    if (sessionId && score.total > 0) {
      this.safeUpdateLeadScore(sessionId, score.total);
    }

    return score;
  }

  /* ================= SAFE MEMORY UPDATE ================= */
  private async safeUpdateLeadScore(sessionId: string, score: number) {

    try {
      // Prevent unnecessary DB writes
      if (score <= 0) return;

      await memoryService.updateStrategicMemory(sessionId, {
        leadScore: score,
      });

      if (process.env.DEBUG_MEMORY === "true") {
        console.log(`[LeadQualifier] leadScore=${score} saved for ${sessionId}`);
      }

    } catch (err) {
      console.warn(`[LeadQualifier] Memory update failed (${sessionId}):`, err);
    }
  }
}

/* ================= SINGLETON ================= */
export const leadQualifier = new LeadQualifier();
