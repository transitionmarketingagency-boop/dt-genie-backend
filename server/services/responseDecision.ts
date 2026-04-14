export function detectBookingRejection(message: string): boolean {
  if (typeof message !== "string") return false;

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

export function shouldIncludeCTA(
  message: string,
  intentCategories: string[] = [],
  leadScore: number = 0,
  stage: string = "discovery"
): boolean {
  const lower = (message || "").toLowerCase();

  const strongIntent =
    /(book|schedule|call|hire|start|work with you|help me scale|i want help)/i.test(
      lower
    );

  const highIntent =
    leadScore >= 6 || stage === "service" || stage === "conversion";

  const weakQuery =
    /(hi|hello|who are you|what do you do)/i.test(lower);

  if (weakQuery) return false;

  return strongIntent || highIntent;
}
