// server/system/identity.ts

import { exec } from "child_process";
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
 * Get embedding by calling local Python script
 */
export async function getPromptEmbedding(prompt: string): Promise<number[]> {
  return new Promise(async (resolve) => {
    try {
      // Escape quotes in prompt for shell
      const safePrompt = prompt.replace(/"/g, '\\"');
      const cmd = `python server/utils/compute_embedding.py "${safePrompt}"`;

      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error("⚠️ Embedding error:", error);
          return resolve([0]); // fallback
        }
        try {
          const embedding = JSON.parse(stdout);
          resolve(embedding);
        } catch (e) {
          console.error("⚠️ Embedding parse error:", e);
          resolve([0]); // fallback
        }
      });
    } catch (err) {
      console.warn("⚠️ getPromptEmbedding fallback triggered:", err);
      resolve([0]);
    }
  });
}
