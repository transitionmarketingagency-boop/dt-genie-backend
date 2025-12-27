import { generateText } from "./services/geminiClient";

(async () => {
  console.log("🚀 Testing Gemini...");
  const reply = await generateText("Say hello in one short sentence.");
  console.log("✅ Gemini Response:", reply);
})();
