// server/services/hardResponses.ts

/**
 * Returns high-confidence static responses only for specific, clear questions.
 * Prevents triggering unnecessarily for generic queries.
 */
export function checkHardResponses(message: string): string | null {
  const msg = message.toLowerCase().trim();

  // Only trigger for precise, unambiguous questions
  if (/your company|about you/.test(msg)) {
    return "Digital Transition Marketing is an AI-powered growth agency focused on building high-performance marketing systems — from performance marketing and automation to predictive analytics and CGI-driven campaigns. We don’t just run ads — we engineer scalable growth systems.";
  }

  if (/cost|price|pricing/.test(msg)) {
    return "Pricing depends on scope and ROI targets — we structure it based on performance and outcomes, not fixed packages. Tell me your goal and I’ll break down what it would realistically cost.";
  }

  // No fallback for partial/ambiguous matches
  return null;
}
