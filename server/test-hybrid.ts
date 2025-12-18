import { generateHybridResponse } from "./services/hybridRouter.js";

async function runTests() {
  console.log("🧪 Testing Hybrid System (Gemma + Gemini)\n");

  console.log("➡️ Simple prompt (should use Gemma locally):");
  const simple = await generateHybridResponse("Say hello in one short sentence.");
  console.log("Response:", simple, "\n");

  console.log("➡️ Complex prompt (should use Gemini cloud):");
  const complex = await generateHybridResponse(
    "Create a detailed digital marketing growth strategy for a travel agency."
  );
  console.log("Response:", complex);
}

runTests().catch(err => {
  console.error("❌ Test failed:", err);
});
