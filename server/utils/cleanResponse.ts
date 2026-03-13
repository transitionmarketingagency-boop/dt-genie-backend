/**
 * Response cleaner
 * Removes formatting artifacts from LLM outputs
 * Does NOT modify meaning or inject branding
 */

export function cleanResponse(raw: string): string {

  if (!raw) return "";

  let text = raw;

  /* ===== REMOVE CODE BLOCKS ===== */

  text = text.replace(/```[\s\S]*?```/g, "");

  /* ===== REMOVE MARKDOWN SYMBOLS ===== */

  text = text
    .replace(/#+\s?/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/_{2,}/g, "")
    .replace(/`/g, "");

  /* ===== REMOVE INTERNAL TOKENS ===== */

  text = text
    .replace(/assistant:/gi, "")
    .replace(/system:/gi, "")
    .replace(/user:/gi, "")
    .replace(/<\|.*?\|>/g, "");

  /* ===== FIX WORD MERGING (camelCase spacing) ===== */

  text = text.replace(/([a-z])([A-Z])/g, "$1 $2");

  /* ===== REMOVE STRANGE CHARACTERS ===== */

  text = text.replace(/[^\x20-\x7E\n\r]/g, "");

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
