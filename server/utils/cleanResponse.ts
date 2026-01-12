// server/utils/cleanResponse.ts

import { BOT_NAME } from "../system/identity.js";

/**
 * Cleans raw AI responses
 * - Removes markdown/stars/noise
 * - Collapses excessive newlines
 * - Removes repeated bot identity mentions
 */
export function cleanResponse(raw: string): string {
  if (!raw || !raw.trim()) {
    return `${BOT_NAME}:`;
  }

  let cleaned = raw;

  // Remove stars, markdown symbols, backticks, hashtags, underscores
  cleaned = cleaned.replace(/[*#_`]+/g, "");

  // Collapse multiple newlines
  cleaned = cleaned.replace(/\n{2,}/g, "\n");

  // Remove accidental repeated bot name mentions
  cleaned = cleaned.replace(
    new RegExp(`(${BOT_NAME}:\\s*)+`, "gi"),
    ""
  );

  // Trim leading/trailing whitespace
  return cleaned.trim();
}
