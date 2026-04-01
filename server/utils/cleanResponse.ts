/**
 * Response Cleaner
 * Cleans LLM outputs while preserving meaning
 * Safe for dynamic responses (no branding injection)
 */
export function cleanResponse(raw: string): string {
  if (!raw) return "";

  let text = raw;

  /* ===== UNICODE NORMALIZATION (prevent hidden issues) ===== */
  text = text.normalize("NFKC");

  /* ===== REMOVE CODE BLOCK MARKERS (keep content) ===== */
  // Instead of removing all code blocks aggressively, preserve code content
  text = text.replace(/```([\s\S]*?)```/g, "$1");

  /* ===== REMOVE MARKDOWN HEADERS ===== */
  text = text.replace(/^#{1,6}\s*/gm, "");

  /* ===== REMOVE MARKDOWN STYLING ===== */
  text = text
    .replace(/\*\*(.*?)\*\*/g, "$1")     // bold
    .replace(/_{2,}(.*?)_{2,}/g, "$1")   // underline/bold alternative
    .replace(/\*(.*?)\*/g, "$1")         // italic
    .replace(/`([^`]*)`/g, "$1");        // inline code

  /* ===== REMOVE INTERNAL TOKENS (strict but safe) ===== */
  text = text
    .replace(/^(assistant|system|user):\s*/gim, "")
    .replace(/<\|im_start\|>|<\|im_end\|>/g, "");

  /* ===== FIX WORD MERGING (camelCase spacing) ===== */
  text = text.replace(/([a-z]{3,})([A-Z][a-z]+)/g, "$1 $2");

  /* ===== REMOVE CONTROL CHARACTERS ===== */
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  /* ===== NORMALIZE WHITESPACE ===== */
  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  /* ===== FIX SENTENCE SPACING ===== */
  text = text.replace(/([.!?])([A-Za-z])/g, "$1 $2");

  /* ===== REMOVE TRAILING ARTIFACT SYMBOLS ===== */
  text = text.replace(/[~`^|<>]+$/g, "");

  /* ===== LENGTH LIMIT (safeguard) ===== */
  if (text.length > 2500) {
    text = text.slice(0, 2500);
  }

  return text;
}
