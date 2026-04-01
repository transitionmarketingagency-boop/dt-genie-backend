/**
 * Response Cleaner (STABLE v2)
 * Cleans LLM outputs while preserving meaning + fixing spacing issues
 */
export function cleanResponse(raw: string): string {
  if (!raw || typeof raw !== "string") return "";

  let text = raw;

  /* ===== UNICODE NORMALIZATION ===== */
  text = text.normalize("NFKC");

  /* ===== REMOVE CODE BLOCK MARKERS (KEEP CONTENT) ===== */
  text = text.replace(/```([\s\S]*?)```/g, "$1");

  /* ===== REMOVE MARKDOWN HEADERS ===== */
  text = text.replace(/^#{1,6}\s*/gm, "");

  /* ===== REMOVE MARKDOWN STYLING (SAFE) ===== */
  text = text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/_{2,}(.*?)_{2,}/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]*)`/g, "$1");

  /* ===== REMOVE INTERNAL TOKENS ===== */
  text = text
    .replace(/^(assistant|system|user):\s*/gim, "")
    .replace(/<\|im_start\|>|<\|im_end\|>/g, "")
    .replace(/<\|.*?\|>/g, ""); // extra safety

  /* ===== FIX WORD MERGING (CRITICAL FIX) ===== */
  // Fix: "businessespecially" → "business especially"
  text = text.replace(/([a-z])([A-Z])/g, "$1 $2");

  // Fix: "businessespecially" (lowercase merges)
  text = text.replace(/([a-z]{4,})([a-z]{4,})/g, (match) => {
    // avoid breaking normal words
    if (match.length < 10) return match;
    return match.slice(0, Math.floor(match.length / 2)) + " " + match.slice(Math.floor(match.length / 2));
  });

  /* ===== FIX MISSING SPACE AFTER PUNCTUATION ===== */
  text = text.replace(/([.!?])([A-Za-z])/g, "$1 $2");

  /* ===== REMOVE CONTROL CHARACTERS ===== */
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  /* ===== NORMALIZE WHITESPACE ===== */
  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  /* ===== REMOVE GARBAGE / MODEL ARTIFACTS ===== */
  const badPatterns = [
    "undefined",
    "null",
    "traceback",
    "error:",
    "exception"
  ];

  const lower = text.toLowerCase();
  if (badPatterns.some((p) => lower.includes(p))) {
    return "";
  }

  /* ===== MIN LENGTH GUARD (prevents junk responses) ===== */
  if (text.length < 25) {
    return "";
  }

  /* ===== MAX LENGTH SAFETY ===== */
  if (text.length > 2000) {
    text = text.slice(0, 2000).trim();
  }

  return text;
}
