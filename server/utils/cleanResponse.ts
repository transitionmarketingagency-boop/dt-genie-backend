/**
 * Response cleaner
 * Removes formatting artifacts from LLM outputs
 * Does NOT modify meaning or inject branding
 */

export function cleanResponse(raw: string): string {

  if (!raw) return "";

  let text = raw;

  /* ===== REMOVE CODE BLOCK MARKERS (keep content) ===== */

  text = text.replace(/```/g, "");

  /* ===== REMOVE MARKDOWN HEADERS ===== */

  text = text.replace(/^#{1,6}\s*/gm, "");

  /* ===== REMOVE MARKDOWN BOLD / ITALIC ===== */

  text = text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_{2,}(.*?)_{2,}/g, "$1")
    .replace(/`(.*?)`/g, "$1");

  /* ===== REMOVE INTERNAL TOKENS (ONLY LINE START) ===== */

  text = text
    .replace(/^assistant:\s*/gim, "")
    .replace(/^system:\s*/gim, "")
    .replace(/^user:\s*/gim, "")
    .replace(/<\|.*?\|>/g, "");

  /* ===== FIX WORD MERGING (camelCase spacing) ===== */

  text = text.replace(/([a-z])([A-Z])/g, "$1 $2");

  /* ===== REMOVE STRANGE CONTROL CHARACTERS ===== */

  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  /* ===== NORMALIZE WHITESPACE ===== */

  text = text
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();

  /* ===== FIX MISSING SPACE AFTER PERIOD ===== */

  text = text.replace(/\.([A-Za-z])/g, ". $1");

  /* ===== LENGTH SAFETY ===== */

  if (text.length > 2500) {
    text = text.slice(0, 2500);
  }

  return text;

}
