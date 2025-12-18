// server/services/gemmaClient.ts
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, "../../.env") });

/**
 * Lightweight LOCAL Gemma stub
 * (No API key required)
 */
export async function generateGemma(prompt: string): Promise<string> {
  // Very fast local response for short/simple prompts
  if (prompt.trim().length < 100) {
    return "Hello there!";
  }

  // Simulate failure for complex prompts
  // (forces Gemini fallback in hybrid)
  return "";
}
