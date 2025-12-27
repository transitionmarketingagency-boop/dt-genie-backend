// server/services/gemmaClient.ts
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getTopChunks } from "../queryChunks";

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, "../../.env") });

/**
 * Simple local embedding function (replace with proper model if needed)
 * Converts each character to a number for demo purposes.
 */
function embedText(text: string): number[] {
  return Array.from(text).map((c) => c.charCodeAt(0) / 255);
}

/**
 * Gemma local response generator
 */
export async function generateGemma(prompt: string): Promise<string> {
  try {
    // Step 1: Compute embedding for the prompt
    const queryEmbedding = embedText(prompt);

    // Step 2: Get top 5 relevant chunks from DB
    const chunks = await getTopChunks(queryEmbedding, 5);

    if (!chunks || chunks.length === 0) {
      return "I'm sorry, I couldn't find relevant information in the knowledge base.";
    }

    // Step 3: Combine the content as context
    const context = chunks.map((c) => c.content).join("\n\n");

    // Step 4: Return combined response
    return `Based on our knowledge base:\n${context}\n\nAnswer: [This is a local-model placeholder response. Replace with your model logic.]`;
  } catch (err) {
    console.error("⚠️ generateGemma error:", err);
    return "I'm sorry, something went wrong in generating the response.";
  }
}

