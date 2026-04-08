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

/* ================= CONTEXT-AWARE FALLBACK ================= */
export function smartFallback(detectedServices?: string[], goals?: string[]): string {
  if (detectedServices?.length) {
    return `I see you're interested in ${detectedServices.join(", ")}. Tell me your main goal and I’ll create a precise strategy.`;
  }
  if (goals?.length) {
    return `Thanks for sharing your goals: ${goals.join(", ")}. Let’s map out the best next steps.`;
  }
  const fallbackOptions = [
    "Let's start by identifying your biggest bottleneck — is it traffic, conversion, or retention?",
    "Focus on 1–2 core channels first (ads, content, or email) and optimize them based on real data.",
    "Provide me your niche and I’ll map a precise execution plan for you.",
  ];
  return fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)];
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
