import { buildPrompt } from "./utils/buildPrompt.js";

(async () => {
  const prompt = await buildPrompt("Tell me about your services");
  console.log("Generated Prompt:\n", prompt);
})();
