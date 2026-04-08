/**
 * Broader high-confidence responses
 * Fuzzy regex and partial matches included
 */
export function checkHardResponses(message: string): string | null {
  const msg = message.toLowerCase().trim();

  // Company info
  if (/who are you|what do you do|tell me about your company|what is your company/i.test(msg)) {
    return "Digital Transition Marketing is an AI-powered growth agency focused on building high-performance marketing systems — from performance marketing and automation to predictive analytics and CGI-driven campaigns. We don’t just run ads — we engineer scalable growth systems.";
  }

  // Pricing info
  if (/pricing|prices|how much do you charge/i.test(msg)) {
    return "Pricing depends on scope and ROI targets — we structure it based on performance and outcomes, not fixed packages. Tell me your goal and I’ll break down what it would realistically cost.";
  }

  // Services / offerings / solutions
  if (/.*(services|offerings|solutions|help with|assist me|recommend).*/i.test(msg)) {
    return "We offer AI-driven marketing automation, performance marketing, SEO, content strategy, and CGI campaigns. Tell me your goal and I’ll map a precise strategy tailored for you.";
  }

  return null;
}
