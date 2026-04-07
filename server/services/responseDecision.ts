// server/services/responseDecision.ts
/**
 * Detect explicit booking rejection or low interest.
 */
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

/**
 * Fallback reasoning with smarter contextual handling.
 * Prevents repeated generic advice for high-leadScore / service queries.
 */
export function smartFallback(message: string, context: string = ""): string {
  const msg = message.toLowerCase();

  // Service-specific guidance first
  if (msg.includes("voice search") || msg.includes("position zero") || msg.includes("seo")) {
    return "To dominate Position Zero, focus on structured content, featured snippets optimization, and voice search strategies for Alexa, Siri, and Google Assistant.";
  }

  if (msg.includes("youtube ads") || msg.includes("video marketing")) {
    return "YouTube Ads work best with clear targeting, compelling hooks, and retention-optimized creatives. Funnel sequencing is critical.";
  }

  if (msg.includes("cgi") || msg.includes("3d tours") || msg.includes("immersive 3d")) {
    return "CGI campaigns convert better with interactive 3D experiences and realistic product renders. Ensure call-to-action alignment.";
  }

  // Context-aware fallback
  if (context && context.length > 40) {
    return `Here’s what’s actually happening in your case:\n\n${context}\n\nThe fastest way forward is identifying the exact bottleneck and fixing that layer directly.`;
  }

  // Generic problems
  if (msg.includes("traffic") && msg.includes("sales")) {
    return "You don’t have a traffic problem — you have a conversion leak. Focus on weak messaging, offer clarity, or funnel friction.";
  }

  if (msg.includes("roas") || msg.includes("ads")) {
    return "ROAS drops often mean creative fatigue or audience saturation. Refresh creatives and restructure targeting.";
  }

  // Short input
  if (msg.length < 10) {
    return "Give me a bit more context — I’ll map a precise strategy for you.";
  }

  // Default fallback
  return `The issue isn’t random — it’s coming from one of three layers:\n1. Traffic quality\n2. Conversion system\n3. Messaging alignment\n\nTell me your current setup — I’ll pinpoint the exact bottleneck.`;
}

/**
 * Determines if a CTA should be included.
 * Enhanced to check intent categories, lead score, stage, and explicit intent words.
 */
export function shouldIncludeCTA(
  message: string,
  intentCategories: string[] = [],
  leadScore: number = 0,
  stage: string = "discovery"
): boolean {
  const lower = message.toLowerCase();

  // Explicit CTA triggers
  const explicitIntent =
    lower.includes("call") ||
    lower.includes("schedule") ||
    lower.includes("consultation") ||
    lower.includes("hire") ||
    lower.includes("start");

  // High intent: either stage or leadScore indicates service-readiness
  const highIntent =
    leadScore >= 6 || stage === "service" || stage === "conversion";

  // Prevent generic CTA for low-leadScore general queries
  if (intentCategories.includes("general") && leadScore < 5) return false;

  return explicitIntent || highIntent;
}
