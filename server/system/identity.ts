// server/system/identity.ts

import { getTopChunks } from "../queryChunks.js";

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

/**
 * Phase-1 embedding stub for local testing
 * Returns the embedding of top-matching chunk for now
 */
export async function getPromptEmbedding(prompt: string): Promise<number[]> {
  try {
    // Use first chunk embedding as placeholder for testing
    const chunks = await getTopChunks([0], 1);
    if (chunks.length) return chunks[0].embedding;
  } catch (err) {
    console.warn("⚠️ getPromptEmbedding fallback triggered:", err);
  }
  return [0]; // fallback
}
