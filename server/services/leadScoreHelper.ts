export function normalizeLeadScore(
  rawScore?: number,
  contextScore?: number
): number {
  let score = 0;

  if (typeof rawScore === "number" && !isNaN(rawScore)) {
    score = rawScore;
  } else if (typeof contextScore === "number" && !isNaN(contextScore)) {
    score = contextScore;
  }

  if (score > 1) score = Math.min(score / 10, 1);
  if (score < 0) score = 0;

  return score;
}

export function determineExecutionMode(
  leadScore: number,
  stage: string
): "execution" | "exploration" {
  const isHighIntent =
    leadScore >= 0.6 ||
    stage === "service" ||
    stage === "conversion";

  return isHighIntent ? "execution" : "exploration";
}
