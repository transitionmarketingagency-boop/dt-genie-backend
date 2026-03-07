// server/system/identity.ts

export const COMPANY_NAME = "Digital Transition Marketing";
export const BOT_NAME = "Neon Vision";

/**
 * Enforces correct bot identity in every response.
 * Prevents model hallucinations like "DT Genie".
 */

export function enforceBotName(response: string): string {

  if (!response) return "";

  let cleaned = response;

  cleaned = cleaned.replace(/dt[\s-]?genie/gi, BOT_NAME);
  cleaned = cleaned.replace(/digital transition ai/gi, COMPANY_NAME);
  cleaned = cleaned.replace(/assistant:/gi, "");
  cleaned = cleaned.replace(/system:/gi, "");

  return cleaned.trim();

}
