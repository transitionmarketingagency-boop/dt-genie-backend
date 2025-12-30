import { generateGemini } from "./services/geminiClient";

(async () => {
  console.log("Testing Gemini response...");
  const reply = await generateGemini("List available Gemini capabilities.");
  console.log("Response:", reply);
})();
