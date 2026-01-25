// server/system/identity.ts

export const COMPANY_NAME = "Digital Transition Marketing";
export const BOT_NAME = "Neon Vision";

/**
 * Identity enforcement ONLY.
 * No embeddings. No similarity. No DB access.
 */
export function enforceBotName(response: string): string {
  if (!response) return "";
  return response
    .replace(/DT-Genie/gi, BOT_NAME)
    .replace(/Digital Transition AI/gi, COMPANY_NAME)
    .trim();
}
