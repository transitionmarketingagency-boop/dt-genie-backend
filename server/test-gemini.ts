// server/test-gemini.ts
import { generateGemini } from "./services/geminiClient.js";

async function run() {
  try {
    const prompt = "Explain what Digital Transition Marketing is in 3 sentences.";
    const res = await generateGemini(prompt);
    console.log("Gemini response:\n", res);
  } catch (err) {
    console.error(err);
  }
}

run();
