// server/scripts/finalSanityTest.js
import { generateHybridResponse } from '../services/generateHybridResponse.js';
import { fetchRelevantChunks } from '../queryChunksWrapper.js';
import { memoryService } from '../services/memoryService.js';

async function runSanityTest() {
  console.log("🚀 Starting DT-Genie Sanity Test...\n");

  const testUser = "sanity-test-user";
  const testQueries = [
    "What is AI marketing?",
    "Explain predictive workflow automation for e-commerce.",
    "Tell me about Digital Transition Marketing",
    "How does the CGI pilot work?",
  ];

  // 1️⃣ Test Hybrid Responses
  console.log("🔹 Testing Hybrid Responses...");
  for (const q of testQueries) {
    const response = await generateHybridResponse(q, testUser);
    console.log(`\nQuery: ${q}`);
    console.log(`Response length: ${response.length}`);
    console.log(`Response snippet: ${response.slice(0, 120)}${response.length > 120 ? '...' : ''}`);
  }

  // 2️⃣ Test Memory Service
  console.log("\n🔹 Checking Memory Service...");
  const history = await memoryService.getHistory(testUser);
  console.log(`Messages stored for ${testUser}: ${history.length}`);
  if (history.length > 0) {
    console.log("Recent messages:");
    history.slice(-5).forEach(m => console.log(`  [${m.role}] ${m.content}`));
  }

  // 3️⃣ Test Knowledge Base / Chunks
  console.log("\n🔹 Fetching Relevant Knowledge Chunks...");
  for (const q of testQueries) {
    const chunks = await fetchRelevantChunks(q, 5);
    console.log(`\nQuery: ${q}`);
    console.log(`Chunks retrieved: ${chunks.length}`);
    chunks.forEach((c, i) => console.log(`  ${i + 1}. Intent: ${c.intent || 'N/A'} | Source: ${c.source || 'N/A'}`));
  }

  // 4️⃣ Test Logging Check
  console.log("\n🔹 Logging Check: Please ensure Hybrid model logs appeared correctly above.");

  console.log("\n✅ Sanity Test Completed. All major systems exercised.");
}

// Run
runSanityTest().catch(err => {
  console.error("❌ Sanity Test Error:", err);
});
