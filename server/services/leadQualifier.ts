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
  budget?: number;      // 0-1
  authority?: number;   // 0-1
  need?: number;        // 0-1
  timeline?: number;    // 0-1
  total: number;        // 0-1 normalized
  stage?: Stage;
}

/* ================= UTILS ================= */
function clamp(val?: number): number {
  if (val === undefined || val === null || isNaN(val)) return 0;
  return Math.max(0, Math.min(1, val));
}

function normalizeStage(stage?: string): Stage {
  const allowed: Stage[] = ["greeting","discovery","strategy","service","conversion"];
  if (stage && allowed.includes(stage as Stage)) return stage as Stage;
  return "discovery";
}

/* ================= CLASS ================= */
export class LeadQualifier {
  private defaultWeights = {
    budget: 0.25,
    authority: 0.25,
    need: 0.35,
    timeline: 0.15,
  };

  /* ================= SCORE LEAD ================= */
  scoreLead(sessionId: string, bantData: Partial<LeadScore>, stageInput: string = "discovery"): LeadScore {
    const stage = normalizeStage(stageInput);
    const weights = { ...this.defaultWeights };

    // Dynamic weighting
    if (stage === "discovery") weights.need += 0.1;
    if (stage === "conversion") weights.budget += 0.1;

    const score: LeadScore = {
      budget: clamp(bantData.budget),
      authority: clamp(bantData.authority),
      need: clamp(bantData.need),
      timeline: clamp(bantData.timeline),
      total: 0,
      stage,
    };

    // ---------- WEIGHTED TOTAL ----------
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

    // ---------- NON-BLOCKING MEMORY UPDATE ----------
    if (sessionId && score.total > 0) {
      this.safeUpdateLeadScore(sessionId, score).catch((err) =>
        console.warn("[LeadQualifier] async memory update failed:", err)
      );
    }

    return score;
  }

  /* ================= SAFE MEMORY UPDATE ================= */
  private async safeUpdateLeadScore(sessionId: string, score: LeadScore) {
    try {
      if (score.total <= 0) return;

      const memoryUpdate: Partial<StrategicMemory> = {
        leadScore: score.total,
        updatedAt: new Date().toISOString(), // FIXED: store as string
      };

      await memoryService.updateStrategicMemory(sessionId, memoryUpdate);

      if (process.env.DEBUG_MEMORY === "true") {
        console.log(`[LeadQualifier] leadScore=${score.total} saved for session ${sessionId}`);
      }
    } catch (err) {
      console.warn(`[LeadQualifier] Memory update failed (${sessionId}):`, err);
    }
  }
}

/* ================= SINGLETON ================= */
export const leadQualifier = new LeadQualifier();
