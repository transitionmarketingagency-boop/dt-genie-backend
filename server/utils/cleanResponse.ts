/**
 * Response cleaner
 * Removes formatting artifacts from LLM outputs
 * Does NOT modify meaning or inject branding
 */
export function cleanResponse(raw: string): string {
  if (!raw) return "";

  let text = raw;

  /* ===== NORMALIZE UNICODE (prevents hidden corruption) ===== */
  text = text.normalize("NFKC");

  /* ===== REMOVE CODE BLOCK MARKERS (keep content) ===== */
  text = text.replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, ""));

  /* ===== REMOVE MARKDOWN HEADERS ===== */
  text = text.replace(/^#{1,6}\s*/gm, "");

  /* ===== REMOVE MARKDOWN BOLD / ITALIC / INLINE CODE (SAFE ORDER) ===== */
  text = text
    .replace(/\*\*(.*?)\*\*/g, "$1")       // bold first
    .replace(/_{2,}(.*?)_{2,}/g, "$1")    // underline / bold alternative
    .replace(/\*(.*?)\*/g, "$1")          // italic (after bold handled)
    .replace(/`([^`]*)`/g, "$1");         // inline code

  /* ===== REMOVE INTERNAL TOKENS (STRICT) ===== */
  text = text
    .replace(/^(assistant|system|user):\s*/gim, "")
    .replace(/<\|im_start\|>|<\|im_end\|>/g, "");

  /* ===== FIX WORD MERGING (SAFE camelCase spacing) ===== */
  text = text.replace(/([a-z]{3,})([A-Z])/g, "$1 $2");

  /* ===== REMOVE CONTROL CHARACTERS ===== */
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  /* ===== NORMALIZE WHITESPACE ===== */
  text = text
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  /* ===== FIX SENTENCE SPACING ===== */
  text = text.replace(/([.!?])([A-Za-z])/g, "$1 $2");

  /* ===== REMOVE TRAILING ARTIFACT SYMBOLS ===== */
  text = text.replace(/[~`^|<>]+$/g, "");

  /* ===== LENGTH SAFETY ===== */
  if (text.length > 2500) {
    text = text.slice(0, 2500);
  }

  return text;
}
