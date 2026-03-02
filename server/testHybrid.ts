// server/testHybrid.js
import 'dotenv/config';
import { generateHybridResponse } from './services/generateHybridResponse.js';
import { getTopChunks } from './queryChunks.js';

const TEST_QUERY = "List all services offered by Digital Transition Marketing";

(async () => {
  try {
    console.log("~B Loading chunks and embeddings...");

    // 1️⃣ Show top 8 chunks for sanity check
    const topChunks = await getTopChunks(TEST_QUERY, 8);
    console.log("\n===== TOP 8 CHUNKS RETRIEVED =====\n");
    topChunks.forEach((c, i) => {
      console.log(`${i + 1}. Score=${c.score.toFixed(3)} | ${c.text.slice(0, 100)}...`);
    });
    console.log("\n==============================\n");

    // 2️⃣ Generate hybrid response (Gemini + embeddings)
    const reply = await generateHybridResponse(TEST_QUERY, "default-session");
    console.log("\n===== HYBRID RESPONSE =====\n", reply);

  } catch (err) {
    console.error("❌ Hybrid test error:", err);
  }
})();
