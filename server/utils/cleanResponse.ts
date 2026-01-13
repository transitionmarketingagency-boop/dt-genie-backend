/**
 * Minimal, safe response cleaner
 * Does NOT inject branding
 * Does NOT replace content
 */
export function cleanResponse(raw: string): string {
  return raw?.trim() || "";
}
