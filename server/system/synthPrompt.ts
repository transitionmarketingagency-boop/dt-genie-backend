// server/system/synthPrompt.ts

import { BOT_NAME } from "./identity.js";

/**
 * Build the system prompt for the LLM
 * Uses context if available, otherwise keeps it minimal
 */
export function buildSynthPrompt(context: string, userPrompt: string): string {
  // ⚡ Short prompt optimization: if context is empty, skip it
  const contextBlock = context && context.trim()
    ? `Context (internal, do not expose):
${context}`
    : "";

  return `
${BOT_NAME}

${contextBlock}

Guidelines:
- Respond as ${BOT_NAME} from Digital Transition Marketing
- Be clear, concise, and professional
- Do NOT repeat raw context
- Do NOT mention sources or chunks
- Provide strategic insight when relevant
- Keep short prompts snappy

User question:
"${userPrompt}"

Answer:
`.trim();
}
