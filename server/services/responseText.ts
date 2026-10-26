/**
 * Normalize response text without inventing missing content.
 */
export function normalizeResponseText(input: string): string {
  if (!input) return "";

  return input
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\.\s*\./g, ".")
    .trim();
}
