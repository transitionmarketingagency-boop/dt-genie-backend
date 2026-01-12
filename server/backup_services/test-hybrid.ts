import "dotenv/config";

import { generateHybridResponse } from "./services/hybridRouter.js";

async function runTests() {
  console.log("🧪 Testing Hybrid System (Gemma + Gemini)\n");

  console.log("➡️ Simple prompt (should use Gemma locally):");
  const simple = await generateHybridResponse(
    "What is Digital Transition Marketing?"
  );
  console.log("Response:\n", simple, "\n");

  console.log("➡️ Complex prompt (should use Gemini cloud):");
  const complex = await generateHybridResponse(
    "Create a full digital growth strategy for a luxury real estate brand using AI tools"
  );
  console.log("Response:\n", complex);
}

runTests().catch(console.error);
