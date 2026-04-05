// server/services/leadQualifier.ts
import { memoryService, StrategicMemory } from "./memoryService.js";

export interface LeadScore {
  budget?: number;      // 0-1
  authority?: number;   // 0-1
  need?: number;        // 0-1
  timeline?: number;    // 0-1
  total: number;        // 0-1 normalized, weighted
}

export class LeadQualifier {
  private weights = {
    budget: 0.25,
    authority: 0.25,
    need: 0.35,
    timeline: 0.15,
  };

  /**
   * Score a lead based on BANT info
   * @param sessionId User session identifier
   * @param bantData Partial BANT data (0-1)
   * @returns LeadScore with weighted total
   */
  scoreLead(sessionId: string, bantData: Partial<LeadScore>): LeadScore {
    const clamp = (val?: number) => Math.max(0, Math.min(1, val ?? 0));

    const score: LeadScore = {
      budget: clamp(bantData.budget),
      authority: clamp(bantData.authority),
      need: clamp(bantData.need),
      timeline: clamp(bantData.timeline),
      total: 0, // initialize
    };

    // Weighted total calculation (0-1 scale)
    score.total =
      (score.budget ?? 0) * this.weights.budget +
      (score.authority ?? 0) * this.weights.authority +
      (score.need ?? 0) * this.weights.need +
      (score.timeline ?? 0) * this.weights.timeline;

    // Optional debug logging
    if (process.env.DEBUG_MEMORY === "true") {
      console.log(`[LeadQualifier] Session ${sessionId} -> Score:`, score);
    }

    // Fire-and-forget memory update (non-blocking)
    this.updateLeadScore(sessionId, score.total).catch((err) =>
      console.warn(`[LeadQualifier] Failed to update leadScore for ${sessionId}:`, err)
    );

    return score;
  }

  /**
   * Update only the leadScore in strategic memory
   * @param sessionId
   * @param score Weighted total (0-1)
   */
  private async updateLeadScore(sessionId: string, score: number) {
    try {
      // Only update leadScore to avoid overwriting other memory fields
      await memoryService.updateStrategicMemory(sessionId, { leadScore: score });
      if (process.env.DEBUG_MEMORY === "true") {
        console.log(`[LeadQualifier] Updated leadScore=${score} for session ${sessionId}`);
      }
    } catch (err) {
      console.error(`[LeadQualifier] Error updating memory for ${sessionId}:`, err);
    }
  }
}

/* -------- Singleton -------- */
export const leadQualifier = new LeadQualifier();
