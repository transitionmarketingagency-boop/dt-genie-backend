// server/utils/test_full_system.ts
import { getTopChunks } from "../queryChunks.js";
import { generateHybridResponse } from "../services/generateHybridResponse.js";
import { aiIntents } from "../services/json_loader.js";

async function testSystem() {
  console.log("🔹 Starting full system test...\n");

  // 1️⃣ Test embedded chunks
  const testMessage = "Tell me about our real estate CGI services";
  console.log("📌 Testing getTopChunks for embeddings...");
  const chunks = await getTopChunks(testMessage, 5, 0.15);
  if (chunks && chunks.length > 0) {
    console.log(`✅ Retrieved ${chunks.length} chunks.`);
    console.log(chunks.map(c => c.text.slice(0, 100) + "...").join("\n"));
  } else {
    console.error("❌ No chunks retrieved. Check embeddings.");
  }

  // 2️⃣ Test JSON intents
  console.log("\n📌 Testing JSON intents matching...");
  console.log(`✅ Total JSON intents loaded: ${aiIntents.length}`);
  const jsonMatch = aiIntents.find(intent => 
    intent.triggers.some(t => testMessage.toLowerCase().includes(t.toLowerCase()))
  );
  if (jsonMatch) {
    console.log(`✅ JSON intent matched:`);
    console.log(jsonMatch.responses.join("\n\n"));
  } else {
    console.log("⚠️ No matching JSON intent found for test message.");
  }

  // 3️⃣ Test hybrid response
  console.log("\n📌 Testing generateHybridResponse...");
  const hybridResponse = await generateHybridResponse(testMessage, "test-session");
  console.log("✅ Hybrid response generated:");
  console.log(hybridResponse);

  console.log("\n🔹 Full system test completed.");
}

testSystem().catch(err => console.error("❌ Test script error:", err));
