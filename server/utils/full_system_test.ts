import { memoryService } from "../services/memoryService.js";
import { getTopChunks } from "../queryChunks.js";
import { gemmaClient } from "../services/gemmaClient.js";
import { geminiClient } from "../services/geminiClient.js";

async function runFullTest() {
  console.log("⚡ Running full system test...");

  try {
    const sessionId = "test_session_001";

    // 1️⃣ Test chat memory
    const history = await memoryService.getHistory(sessionId);
    console.log(`✅ Chat memory messages: ${history.length}`);

    // 2️⃣ Test vector store
    const query = "AI marketing systems";
    const topChunks = getTopChunks(query);
    console.log(`✅ Vector store entries: ${topChunks.length}`);
    console.log(`✅ Top chunks for query "${query}":`);
    topChunks.forEach(c => console.log(`  - ${c.file} (score: ${c.score})`));

    // 3️⃣ Test Gemma
    console.log("\n🧠 Testing Gemma AI client...");
    try {
      const gemmaResponse = await gemmaClient("Explain AI marketing systems in simple terms");
      console.log("✅ Gemma response:", gemmaResponse.slice(0, 200), gemmaResponse.length > 200 ? "..." : "");
    } catch (err: any) {
      console.error("❌ Gemma test failed:", err.message || err);
    }

    // 4️⃣ Test Gemini
    console.log("\n🤖 Testing Gemini AI client...");
    try {
      const geminiResponse = await geminiClient("Explain AI marketing systems in simple terms");
      console.log("✅ Gemini response:", geminiResponse.slice(0, 200), geminiResponse.length > 200 ? "..." : "");
    } catch (err: any) {
      console.error("❌ Gemini test failed:", err.message || err);
    }

    console.log("\n🎯 Full system test completed successfully.");
  } catch (err: any) {
    console.error("❌ Full system test failed:", err.message || err);
    process.exit(1);
  }
}

runFullTest();
