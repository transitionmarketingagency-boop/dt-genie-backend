// server/services/responseUtilities.ts
export const MAX_CONTEXT_CHARS = 1400;

export function compressContext(chunks: any[], maxLength: number = 320): string {
  if (!chunks?.length) return "";
  const seen = new Set<string>();

  return chunks
    .map((c, i) => {
      const txt = c?.text?.replace(/\s+/g, " ").trim().slice(0, maxLength);
      if (!txt || seen.has(txt)) return "";
      seen.add(txt);
      return `[Knowledge ${i + 1}] ${txt}`;
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_CONTEXT_CHARS);
}

export function compressResponse(text: string): string {
  if (text.length < 1200) return text;
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return text;
  const selected = sentences.slice(0, 6).join(" ").trim();
  return /[.!?]$/.test(selected) ? selected : selected + ".";
}

export function sanitizeTools(text: string): string {
  const toolMap: Record<string, string> = {
    Creatify: "advanced AI content systems",
    Wisepops: "AI marketing automation tools",
    "AdCreative.ai": "AI ad optimization systems",
    "AIclicks.io": "AI performance tracking tools",
    OpenAI: "proprietary AI systems",
    Midjourney: "proprietary AI systems",
  };

  for (const [tool, replacement] of Object.entries(toolMap)) {
    text = text.replace(new RegExp(`\\b${tool}\\b`, "gi"), replacement);
  }

  return text;
}

export function removeContactInfo(text: string): string {
  if (!text) return "";

  text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "");
  text = text.replace(/\+?\d[\d\s-]{7,}\d/g, "");
  text = text.replace(/\d{1,5}\s\w+(\s\w+){0,5},?\s\w{2,20}/gi, "");
  text = text.replace(/(contact us at|reach us at|email us at|call us at)[^.]*\./gi, "");

  return text;
}

export function cleanHybridResponse(text: string): string {
  if (!text) return "";
  text = sanitizeTools(text);
  text = removeContactInfo(text);
  text = text.replace(/\s+/g, " ");
  return text.trim();
}

export function isLowQuality(text: string): boolean {
  if (!text) return true;
  if (text.length < 20) return true;
  if (text.split(" ").length < 6) return true;
  if (text.includes("I'm having trouble") || text.includes("something went wrong")) return true;
  return false;
}

export function looksIncomplete(text: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();

  if (trimmed.length < 15) return true;
  if (!/[.!?]$/.test(trimmed) && trimmed.length < 60) return false;
  if (/[,$:]$/.test(trimmed)) return true;
  if (/\$\s*$/.test(trimmed)) return true;
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(trimmed)) return true;
  if (trimmed.toLowerCase().includes("couldn't generate") || trimmed.toLowerCase().includes("something went wrong")) return true;
  if (!/[a-zA-Z]/.test(trimmed)) return true;

  return false;
}
