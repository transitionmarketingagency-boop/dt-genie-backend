// server/services/responseDecision.ts

/* ================= BOOKING REJECTION ================= */
export function detectBookingRejection(message: string): boolean {
  const msg = message.toLowerCase();
  return (
    msg.includes("not now") ||
    msg.includes("don't want") ||
    msg.includes("dont want") ||
    msg.includes("later") ||
    msg.includes("no thanks") ||
    msg.includes("stop") ||
    msg.includes("just exploring") ||
    msg.includes("not interested")
  );
}

/* ================= SAFE FALLBACK ================= */
export function smartFallback(): string {
  return "Tell me your goal and I’ll map a precise strategy for you.";
}

/* ================= CTA LOGIC ================= */
export function shouldIncludeCTA(
  message: string,
  intentCategories: string[] = [],
  leadScore: number = 0,
  stage: string = "discovery"
): boolean {
  const lower = message.toLowerCase();

  const explicitIntent =
    lower.includes("call") ||
    lower.includes("schedule") ||
    lower.includes("consultation") ||
    lower.includes("hire") ||
    lower.includes("start");

  const highIntent =
    leadScore >= 6 || stage === "service" || stage === "conversion";

  if (intentCategories.includes("general") && leadScore < 5) return false;

  return explicitIntent || highIntent;
}
