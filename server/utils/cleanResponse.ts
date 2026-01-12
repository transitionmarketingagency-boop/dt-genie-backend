// server/utils/cleanResponse.ts

import { BOT_NAME } from "../system/identity.js";

export function cleanResponse(raw: string): string {
  if (!raw || !raw.trim()) {
    return `${BOT_NAME}:`;
  }

  let cleaned = raw;

  // Remove stars, markdown noise, excessive newlines
  cleaned = cleaned.replace(/[*#_`]+/g, "");
  cleaned = cleaned.replace(/\n{2,}/g, "\n");

  // Remove accidental double identity
  cleaned = cleaned.replace(
    new RegExp(`(${BOT_NAME}:\\s*)+`, "gi"),
    ""
  );

  return cleaned.trim();
}
