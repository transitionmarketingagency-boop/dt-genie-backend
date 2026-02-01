import { generateHybridResponse } from "../services/generateHybridResponse.js";
import { fetchRelevantChunks } from "../queryChunksWrapper.js";
import { memoryService } from "../services/memoryService.js";

async function runFinalSanityTest() {
  console.log("✅ DT-Genie final sanity test starting...");

  const testPrompts = [
    "What is AI marketing?",
    "Explain the CGI & Performance Ads Pilot",
    "What are your agency differentiators?",
  ];

  for (const prompt of testPrompts) {
    console.log(`\n➡️ Generating hybrid response for: "${prompt}"`);
    const response = await generateHybridResponse(prompt, "test");
    console.log("✅ Hybrid Response:\n", response);

    console.log("\n➡️ Fetching relevant chunks...");
    const chunks = await fetchRelevantChunks(prompt, 5);
    if (chunks.length === 0) console.warn("⚠️ No relevant chunks found");
    chunks.forEach((c, idx) =>
      console.log(`  ${idx + 1}. ${c.source || "No source"}`)
    );

    console.log("\n➡️ Testing memory service...");
    await memoryService.addMessage("session-1", "user", prompt);
    await memoryService.addMessage("session-1", "assistant", response);
  }

  const memHistory = await memoryService.getHistory("session-1");
  console.log("✅ Memory history:");
  memHistory.forEach((m, idx) =>
    console.log(`  ${idx + 1}. [${m.role}] ${m.content}`)
  );

  console.log("\n✅ DT-Genie final sanity test completed successfully.");
}

runFinalSanityTest();
