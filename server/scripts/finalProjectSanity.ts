import { generateHybridResponse } from "../services/generateHybridResponse.js";
import { fetchRelevantChunks } from "../queryChunksWrapper.js";
import { memoryService } from "../services/memoryService.js";

async function runProjectSanityTest() {
  console.log("✅ DT-Genie Full Project Sanity Test Starting...");

  const testPrompts = [
    "What is AI marketing?",
    "Explain the CGI & Performance Ads Pilot",
    "What are your agency differentiators?",
  ];

  for (const prompt of testPrompts) {
    console.log(`\n➡️ Hybrid Response Test for: "${prompt}"`);
    const response = await generateHybridResponse(prompt, "test");
    console.log("✅ Hybrid Response:\n", response);

    console.log("\n➡️ Chunk Retrieval Test...");
    const chunks = await fetchRelevantChunks(prompt, 5);
    if (chunks.length === 0) console.warn("⚠️ No relevant chunks found");
    chunks.forEach((c, idx) =>
      console.log(`  ${idx + 1}. ${c.source || "No source"}`)
    );

    await memoryService.addMessage("session-1", "user", prompt);
    await memoryService.addMessage("session-1", "assistant", response);
  }

  const memHistory = await memoryService.getHistory("session-1");
  console.log("\n✅ Memory history:");
  memHistory.forEach((m, idx) =>
    console.log(`  ${idx + 1}. [${m.role}] ${m.content}`)
  );

  console.log("\n✅ DT-Genie Full Project Sanity Test Completed Successfully.");
}

runProjectSanityTest();
