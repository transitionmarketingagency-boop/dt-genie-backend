// server/geminiClient.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

// Ensure GEMINI_API_KEY exists
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ Missing GEMINI_API_KEY in environment variables.");
  process.exit(1);
}

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Get the Gemini 2.5 Flash model
export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});
