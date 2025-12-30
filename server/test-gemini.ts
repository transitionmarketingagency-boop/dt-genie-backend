import { generateGemini } from "./services/geminiClient";

(async () => {
  console.log("~@ Testing Gemini...");
  const reply = await generateGemini("Say hello in one short sentence.");
  console.log("✅ Gemini Response:", reply);
})();
