// server/services/hardResponses.ts

/**
 * Strict high-confidence responses
 * Only triggers on VERY specific queries
 */
export function checkHardResponses(message: string): string | null {
  const msg = message.toLowerCase().trim();

  // ✅ VERY STRICT match (no accidental triggers)
  if (/^(tell me about your company|what is your company|who are you)$/.test(msg)) {
    return "Digital Transition Marketing is an AI-powered growth agency focused on building high-performance marketing systems — from performance marketing and automation to predictive analytics and CGI-driven campaigns. We don’t just run ads — we engineer scalable growth systems.";
  }

  if (/^(what are your prices|what is your pricing|how much do you charge)$/.test(msg)) {
    return "Pricing depends on scope and ROI targets — we structure it based on performance and outcomes, not fixed packages. Tell me your goal and I’ll break down what it would realistically cost.";
  }

  return null;
}
