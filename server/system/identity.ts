// server/system/identity.ts
import { getTopChunks } from "../queryChunks.js";

export const COMPANY_NAME = "Digital Transition Marketing";
export const BOT_NAME = "Neon Vision";

export function enforceBotName(response: string, userPrompt: string): string {
  if (!response) return "";
  response = response.replace(/Neon Vision Marketing/gi, COMPANY_NAME);
  response = response.replace(/Neon Vision Agency/gi, COMPANY_NAME);
  return response.trim();
}

// ------------------ EMBEDDING HELPER ------------------
export async function getPromptEmbedding(prompt: string): Promise<number[]> {
  try {
    // For Phase-2 testing, get first chunk's embedding
    const chunks = await getTopChunks([], 1); // pass empty array to satisfy TS
    if (chunks.length && chunks[0].embedding) return chunks[0].embedding;
  } catch (err) {
    console.warn("⚠️ getPromptEmbedding fallback triggered:", err);
  }
  return Array(1536).fill(0);
}

