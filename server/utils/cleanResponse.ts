/**
 * Response Cleaner (PRODUCTION v3 - Unified)
 * Fixes spacing, removes artifacts, preserves meaning, prevents junk outputs
 */

export function cleanResponse(raw: string): string {
  if (!raw || typeof raw !== "string") return "";

  let text = raw;

  /* ================= UNICODE NORMALIZATION ================= */
  text = text.normalize("NFKC");

  /* ================= REMOVE CODE BLOCKS (KEEP CONTENT) ================= */
  text = text.replace(/```([\s\S]*?)```/g, "$1");

  /* ================= REMOVE MARKDOWN STRUCTURE ================= */
  text = text
    .replace(/^#{1,6}\s*/gm, "") // headers
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold
    .replace(/_{2,}(.*?)_{2,}/g, "$1") // underline
    .replace(/\*(.*?)\*/g, "$1") // italic
    .replace(/`([^`]*)`/g, "$1"); // inline code

  /* ================= REMOVE MODEL TOKENS ================= */
  text = text
    .replace(/^(assistant|system|user):\s*/gim, "")
    .replace(/<\|im_start\|>|<\|im_end\|>/g, "")
    .replace(/<\|.*?\|>/g, "");

  /* ================= FIX WORD MERGING ISSUES ================= */
  text = text
    // businessespecially -> business especially
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // fix punctuation spacing
    .replace(/([.!?])([A-Za-z])/g, "$1 $2");

  /* ================= REMOVE CONTROL CHARACTERS ================= */
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  /* ================= NORMALIZE WHITESPACE ================= */
  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();

  /* ================= HARD GARBAGE FILTER ================= */
  const badPatterns = [
    "undefined",
    "null",
    "traceback",
    "error:",
    "exception",
    "something went wrong",
    "i'm having trouble",
  ];

  const lower = text.toLowerCase();
  if (badPatterns.some((p) => lower.includes(p))) {
    return "";
  }

  /* ================= LENGTH GUARDS ================= */
  if (text.length < 18) return "";

  if (text.length > 2000) {
    text = text.slice(0, 2000).trim();
  }

  return text;
}
