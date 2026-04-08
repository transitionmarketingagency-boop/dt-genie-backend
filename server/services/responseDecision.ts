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
    lower.includes("start") ||
    lower.includes("help with") ||
    lower.includes("assist me") ||
    lower.includes("recommend services");

  const highIntent = leadScore >= 5 || ["service", "conversion"].includes(stage);

  if (intentCategories.includes("general") && leadScore < 5) return false;

  return explicitIntent || highIntent;
}
