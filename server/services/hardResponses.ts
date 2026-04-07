export function checkHardResponses(message: string): string | null {
  const msg = message.toLowerCase();

  if (msg.includes("your company") || msg.includes("about you")) {
    return "Digital Transition Marketing is an AI-powered growth agency focused on building high-performance marketing systems — from performance marketing and automation to predictive analytics and CGI-driven campaigns. We don’t just run ads — we engineer scalable growth systems.";
  }

  if (msg.includes("cost") || msg.includes("price")) {
    return "Pricing depends on scope and ROI targets — we structure it based on performance and outcomes, not fixed packages. Tell me your goal and I’ll break down what it would realistically cost.";
  }

  return null;
}
