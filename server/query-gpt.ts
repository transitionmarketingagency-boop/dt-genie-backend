// server/query-gpt.ts
import 'dotenv/config'; // Loads .env automatically
import { buildPrompt } from "./utils/buildPrompt.js";
import { GoogleAuth } from "google-auth-library";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const GEMINI_LOCATION = process.env.GEMINI_LOCATION || "us-central1";
const GEMINI_PROJECT_ID = process.env.GEMINI_PROJECT_ID;

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS || !GEMINI_PROJECT_ID) {
  throw new Error("❌ Google service account or project ID not set in .env");
}

/**
 * Call Gemini API using service account authentication
 */
async function callGemini(prompt: string) {
  const auth = new GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  const client = await auth.getClient();

  const url = `https://${GEMINI_LOCATION}-aiplatform.googleapis.com/v1/projects/${GEMINI_PROJECT_ID}/locations/${GEMINI_LOCATION}/publishers/google/models/${GEMINI_MODEL}:predict`;

  const res = await client.request({
    url,
    method: 'POST',
    data: {
      instances: [{ content: prompt }],
      parameters: { temperature: 0.2, maxOutputTokens: 512 },
    },
  });

const data: any = res.data;
return data?.predictions?.[0]?.content || "";
}

/**
 * Main execution
 */
async function main() {
  try {
    const question = "Tell me about your services";

    console.log("🔍 Question:", question);

    // RAG: build prompt using top relevant chunks
    const prompt = await buildPrompt(question);

    console.log("\n🧠 Final Prompt Sent to Gemini:\n");
    console.log(prompt);
    console.log("\n------------------------------\n");

    const response = await callGemini(prompt);

    console.log("🤖 AI Response:\n");
    console.log(response);
  } catch (err) {
    console.error("❌ query-gpt failed:", err);
  }
}

main();
