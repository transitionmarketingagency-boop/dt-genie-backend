// server/services/leadQualifier.ts
import { memoryService, StrategicMemory } from "./memoryService.js";

export interface LeadScore {
  budget?: number;      // 0-1
  authority?: number;   // 0-1
  need?: number;        // 0-1
  timeline?: number;    // 0-1
  total?: number;       // weighted total
}

/* -------- Lead Qualifier -------- */
export class LeadQualifier {
  private weights = {
    budget: 0.25,
    authority: 0.25,
    need: 0.35,
    timeline: 0.15,
  };

  /**
   * Score a lead based on provided BANT info
   * @param sessionId User session identifier
   * @param bantData Partial BANT data with values 0-1
   */
  scoreLead(sessionId: string, bantData: Partial<LeadScore>): LeadScore {
    // Ensure all values are clamped between 0 and 1
    const clamp = (val?: number) => Math.max(0, Math.min(1, val ?? 0));

    const score: LeadScore = {
      budget: clamp(bantData.budget),
      authority: clamp(bantData.authority),
      need: clamp(bantData.need),
      timeline: clamp(bantData.timeline),
    };

    score.total =
      (score.budget ?? 0) * this.weights.budget +
      (score.authority ?? 0) * this.weights.authority +
      (score.need ?? 0) * this.weights.need +
      (score.timeline ?? 0) * this.weights.timeline;

    // Async update to memoryService, non-blocking
    this.updateLeadScore(sessionId, score.total).catch((err) =>
      console.warn(`⚠️ Failed to update lead score for session ${sessionId}:`, err)
    );

    return score;
  }

  /**
   * Update total lead score in memoryService
   * @param sessionId User session identifier
   * @param score Total lead score
   */
  private async updateLeadScore(sessionId: string, score?: number) {
    try {
      const memory: StrategicMemory = (await memoryService.getStrategicMemory(sessionId)) || {};
      await memoryService.updateStrategicMemory(sessionId, { ...memory, leadScore: score });
    } catch (err) {
      console.error(`❌ Error updating strategic memory for session ${sessionId}:`, err);
    }
  }
}

/* -------- Singleton -------- */
export const leadQualifier = new LeadQualifier();
