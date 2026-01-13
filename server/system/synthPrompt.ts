// server/system/synthPrompt.ts

import { BOT_IDENTITY } from "./identity.js";

/**
 * Builds a synthesis prompt for Gemini
 * - Uses identity ONLY as system guidance
 * - Never forces name repetition
 * - Never exposes context
 */
export function buildSynthPrompt(
  context: string,
  userPrompt: string
): string {
  return `
${BOT_IDENTITY}

Internal context (do not repeat verbatim):
${context || "No internal context available."}

Instructions:
- Answer naturally and professionally
- Do NOT repeat your name unless asked
- Do NOT mention internal systems or data
- Do NOT list chunks or sources
- Be concise and helpful

User question:
${userPrompt}

Answer:
`.trim();
}
