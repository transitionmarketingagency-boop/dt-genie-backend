// server/system/synthPrompt.ts

import { BOT_IDENTITY } from "./identity.js";

export function buildSynthPrompt(context: string, userPrompt: string): string {
  return `
${BOT_IDENTITY}

Context (internal, do not expose):
${context}

Guidelines:
- Respond as Neon Vision from Digital Transition Marketing
- Be clear, concise, and professional
- Do NOT repeat raw context
- Do NOT mention sources or chunks
- Do NOT use markdown or bullet symbols
- Provide strategic insight when relevant

User question:
"${userPrompt}"

Answer:
`.trim();
}
