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

  const toolMap: Record<string, string> = {
    Creatify: "AI content systems",
    Wisepops: "AI marketing tools",
    "AdCreative.ai": "AI ad optimization systems",
    "AIclicks.io": "AI performance tracking tools",
    OpenAI: "AI systems",
    Midjourney: "AI visual systems",
  };

  let cleaned = text;

  for (const [tool, replacement] of Object.entries(toolMap)) {
    cleaned = cleaned.replace(new RegExp(`\\b${tool}\\b`, "gi"), replacement);
  }

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
