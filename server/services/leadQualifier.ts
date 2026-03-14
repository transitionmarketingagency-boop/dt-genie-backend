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

  /* Score a lead based on provided BANT info */
  scoreLead(sessionId: string, bantData: Partial<LeadScore>): LeadScore {
    const score: LeadScore = {
      budget: bantData.budget ?? 0,
      authority: bantData.authority ?? 0,
      need: bantData.need ?? 0,
      timeline: bantData.timeline ?? 0,
    };

    score.total =
      (score.budget ?? 0) * this.weights.budget +
      (score.authority ?? 0) * this.weights.authority +
      (score.need ?? 0) * this.weights.need +
      (score.timeline ?? 0) * this.weights.timeline;

    // Save to strategic memory
    this.updateLeadScore(sessionId, score.total);

    return score;
  }

  /* Update total lead score in memoryService */
  private async updateLeadScore(sessionId: string, score?: number) {
    const memory: StrategicMemory = await memoryService.getStrategicMemory(sessionId);
    await memoryService.updateStrategicMemory(sessionId, { ...memory, leadScore: score });
  }
}

/* -------- Singleton -------- */
export const leadQualifier = new LeadQualifier();
