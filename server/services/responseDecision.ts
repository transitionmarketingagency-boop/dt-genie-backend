/* ================= BOOKING REJECTION ================= */
export function detectBookingRejection(message: string): boolean {
  const msg = message.toLowerCase();

  return [
    "not now",
    "dont want",
    "don't want",
    "later",
    "no thanks",
    "stop",
    "just exploring",
    "not interested",
  ].some((phrase) => msg.includes(phrase));
}

/* ================= CTA LOGIC ================= */
export function shouldIncludeCTA(
  message: string,
  intentCategories: string[] = [],
  leadScore: number = 0,
  stage: string = "discovery"
): boolean {
  const lower = message.toLowerCase();

  /* -------- STRONG INTENT ONLY -------- */
  const strongIntent =
    /(book|schedule|call|hire|start|work with you|help me scale|i want help)/i.test(
      lower
    );

  /* -------- HIGH LEAD QUALITY -------- */
  const highIntent = leadScore >= 6 || ["service", "conversion"].includes(stage);

  /* -------- BLOCK LOW QUALITY CTA -------- */
  const weakQuery =
    /(hi|hello|who are you|what do you do)/i.test(lower);

  if (weakQuery) return false;

  /* -------- FINAL DECISION -------- */
  return strongIntent || highIntent;
}
