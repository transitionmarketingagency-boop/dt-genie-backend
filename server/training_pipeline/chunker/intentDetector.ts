export function detectIntent(text: string): string {
  const t = text.toLowerCase();

  if (/price|cost|quote|budget|timeline/.test(t)) return "sales";
  if (/how to|process|steps|workflow/.test(t)) return "process";
  if (/strategy|plan|growth|scale/.test(t)) return "marketing";
  if (/who are you|about|company|agency/.test(t)) return "brand";
  if (/tools|ai|automation|software/.test(t)) return "tools";
  if (/faq|support|help|issue/.test(t)) return "support";

  return "general";
}
