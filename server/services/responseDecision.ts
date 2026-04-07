// server/services/responseDecision.ts
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

export function smartFallback(message: string, context: string = ""): string {
  const msg = message.toLowerCase();

  if (context && context.length > 40) {
    return `Here’s what’s actually happening in your case:\n\n${context}\n\nThe fastest way forward is identifying the exact bottleneck and fixing that layer directly.`;
  }

  if (msg.includes("traffic") && msg.includes("sales")) {
    return "You don’t have a traffic problem — you have a conversion leak. This usually comes from weak messaging, poor offer clarity, or funnel friction. Fix the drop-off point first.";
  }

  if (msg.includes("roas") || msg.includes("ads")) {
    return "ROAS drops during scaling usually mean creative fatigue or audience saturation. The fix is refreshing creatives and restructuring targeting — not just increasing budget.";
  }

  if (msg.length < 10) {
    return "Give me a bit more context — I’ll map a precise strategy for you.";
  }

  return `The issue isn’t random — it’s coming from one of three layers:\n1. Traffic quality\n2. Conversion system\n3. Messaging alignment\n\nTell me your current setup — I’ll pinpoint the exact bottleneck.`;
}

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
