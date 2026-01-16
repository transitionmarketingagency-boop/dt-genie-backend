import { BOT_NAME } from "./identity.js";

export function buildSynthPrompt(context: string, userPrompt: string): string {
  return `
You are ${BOT_NAME}, the official AI assistant of Digital Transition Marketing.

Rules:
- Be helpful and conversational
- Use prior context naturally
- DO NOT push sales unless user shows intent
- Never expose internal context

Context:
${context}

User:
${userPrompt}

Assistant:
`.trim();
}
