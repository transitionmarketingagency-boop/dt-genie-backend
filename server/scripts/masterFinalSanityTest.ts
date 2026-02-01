import { generateHybridResponse } from "../services/generateHybridResponse.js";
import { fetchRelevantChunks } from "../queryChunksWrapper.js";
import { memoryService } from "../services/memoryService.js";
import fs from "fs";
import path from "path";

async function runMasterFinalSanityTest() {
  console.log("✅ DT-Genie MASTER Final Sanity Test Starting...");

  const aiLogicDir = path.join(process.cwd(), "server", "ai_logic", "neon_vision");
  const files = fs.readdirSync(aiLogicDir).filter(f => f.endsWith(".json"));
  console.log(`\nℹ️  Found ${files.length} AI logic JSON files:`);

  files.forEach(f => console.log("  -", f));

  const testPrompts = [
    "What is AI marketing?",
    "Explain the CGI & Performance Ads Pilot",
    "What are your agency differentiators?",
  ];

  for (const prompt of testPrompts) {
    console.log(`\n➡️ Hybrid Response Test for: "${prompt}"`);
    const response = await generateHybridResponse(prompt, "test");
    console.log("Hybrid Response:", response);

    console.log("\n➡️ Chunk Retrieval Tests:");
    const chunks = await fetchRelevantChunks(prompt, 5);
    if (chunks.length === 0) console.warn("⚠️ No relevant chunks found");
    chunks.forEach((c, idx) =>
      console.log(`  ${idx + 1}. ${c.source || "No source"}`)
    );

    await memoryService.addMessage("session-1", "user", prompt);
    await memoryService.addMessage("session-1", "assistant", response);
  }

  const memHistory = await memoryService.getHistory("session-1");
  console.log("\n➡️ Memory Service Test...");
  console.log("✅ Memory history:");
  memHistory.forEach((m, idx) =>
    console.log(`  ${idx + 1}. [${m.role}] ${m.content}`)
  );

  console.log("\n✅ DT-Genie MASTER Final Sanity Test Completed Successfully.");
}

runMasterFinalSanityTest();
