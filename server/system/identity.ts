// server/system/identity.ts

export const COMPANY_NAME = "Digital Transition Marketing";
export const BOT_NAME = "Neon Vision";

/**
 * Enforce correct bot identity without hallucination
 */
export function enforceBotName(response: string, userPrompt: string): string {
  if (!response) return "";

  // Never let the model rename the company
  response = response.replace(/Neon Vision Marketing/gi, COMPANY_NAME);
  response = response.replace(/Neon Vision Agency/gi, COMPANY_NAME);

  return response.trim();
}
