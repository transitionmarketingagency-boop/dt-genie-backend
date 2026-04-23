export const MAX_CONTEXT_CHARS = 1400;

/* ================= CONTEXT COMPRESSION ================= */
export function compressContext(
  chunks: any[],
  maxLength: number = 320
): string {
  if (!Array.isArray(chunks) || chunks.length === 0) return "";

  const seen = new Set<string>();

  return chunks
    .map((c, i) => {
      const txt =
        typeof c?.text === "string"
          ? c.text.replace(/\s+/g, " ").trim().slice(0, maxLength)
          : "";

      if (!txt || seen.has(txt)) return "";
      seen.add(txt);

      return `[Knowledge ${i + 1}] ${txt}`;
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_CONTEXT_CHARS);
}

/* ================= RESPONSE COMPRESSION ================= */
export function compressResponse(text: string): string {
  if (typeof text !== "string") return "";
  if (text.length < 1200) return text;

  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return text;

  let selected = sentences.slice(0, 6).join(" ").trim();

  if (!/[.!?]$/.test(selected)) selected += ".";

  return selected;
}

/* ================= TOOL SANITIZATION ================= */
export function sanitizeTools(text: string): string {
  if (typeof text !== "string") return "";

  let cleaned = text;

  // ================= EXACT TOOL REPLACEMENTS =================
  const toolMap: Record<string, string> = {
    // Content / Ads
    "AdCreative.ai": "AI ad optimization systems",
    Jasper: "AI content systems",
    "Copy.ai": "AI content systems",    

    // Automation / CRM
    Zapier: "automation systems",
    HubSpot: "CRM systems",
    Salesforce: "CRM systems",
    Klaviyo: "email automation systems",
    Mailchimp: "email systems",

    // AI / Models
    OpenAI: "AI systems",
    ChatGPT: "AI systems",
    Gemini: "AI systems",
    Claude: "AI systems",

    // Video / Media
    Synthesia: "AI video systems",
    Runway: "AI video systems",
    Descript: "AI media systems",

    // Social / Analytics
    "Sprout Social": "social media systems",
    "Meta Ads Manager": "ad management systems",

    // Misc
    Creatify: "AI content systems",
    Wisepops: "AI marketing tools",
    "AIclicks.io": "AI performance tracking tools",
    Midjourney: "AI visual systems",
  };

  for (const [tool, replacement] of Object.entries(toolMap)) {
    cleaned = cleaned.replace(new RegExp(`\\b${tool}\\b`, "gi"), replacement);
  }

  // ================= REMOVE "Tool: XYZ" STRUCTURES =================
  cleaned = cleaned.replace(/Tool:\s*[A-Za-z0-9.\- ]+/gi, "AI system");

  // ================= REMOVE RANDOM TOOL-LIKE PATTERNS =================
  cleaned = cleaned.replace(
    /\b([A-Z][a-zA-Z0-9]+(?:\.[a-zA-Z]+)?(?:\s[A-Z][a-zA-Z0-9]+)?)\b(?=.*(tool|platform|software))/gi,
    "AI system"
  );

  // ================= CLEAN LEFTOVER BRAND DOMAINS =================
  cleaned = cleaned.replace(/\b[a-z0-9.-]+\.(com|ai|io|app)\b/gi, "");

  // ================= FINAL NORMALIZATION =================
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

/* ================= REMOVE CONTACT INFO ================= */
export function removeContactInfo(text: string): string {
  if (typeof text !== "string") return "";

  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "")
    .replace(/\+?\d[\d\s-]{7,}\d/g, "")
    .replace(/\d{1,5}\s\w+(\s\w+){0,5},?\s\w{2,20}/gi, "")
    .replace(
      /(contact us at|reach us at|email us at|call us at)[^.]*\./gi,
      ""
    );
}

/* ================= MAIN CLEANER (STANDARDIZED) ================= */
export function cleanHybridResponse(text: string): string {
  if (typeof text !== "string") return "";

  let cleaned = sanitizeTools(text);
  cleaned = removeContactInfo(cleaned);
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  if (cleaned.length < 25) return "";

  return cleaned;
}

/* ================= QUALITY CHECKS ================= */
export function isLowQuality(text: string): boolean {
  if (typeof text !== "string") return true;

  return (
    text.length < 20 ||
    text.split(" ").length < 6 ||
    text.includes("I'm having trouble") ||
    text.includes("something went wrong")
  );
}

export function looksIncomplete(text: string): boolean {
  if (typeof text !== "string") return true;

  const trimmed = text.trim();

  if (trimmed.length < 15) return true;
  if (/[,$:]$/.test(trimmed)) return true;
  if (/\$\s*$/.test(trimmed)) return true;

  if (
    trimmed.toLowerCase().includes("couldn't generate") ||
    trimmed.toLowerCase().includes("something went wrong")
  ) {
    return true;
  }

  return !/[a-zA-Z]/.test(trimmed);
}
