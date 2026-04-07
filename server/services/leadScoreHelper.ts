// server/services/leadScoreHelper.ts

/**
 * Normalize lead score to 0-1 range, preferring rawScore over contextScore.
 */
export function normalizeLeadScore(rawScore?: number, contextScore?: number): number {
  let score = 0;
  if (typeof rawScore === "number") score = rawScore;
  else if (typeof contextScore === "number") score = contextScore;

  // Force 0–1 range
  if (score > 1) score = Math.min(score / 10, 1);
  if (score < 0) score = 0;
  return score;
}

/**
 * Determines execution mode based on leadScore and stage.
 * - "execution" for high intent/service-ready
 * - "exploration" for low intent/generic queries
 */
export function determineExecutionMode(leadScore: number, stage: string): "execution" | "exploration" {
  return leadScore >= 0.6 || stage === "service" || stage === "conversion" ? "execution" : "exploration";
}
