// server/utils/full_system_test.ts

import "dotenv/config";

import { memoryService } from "../services/memoryService.js";
import { getTopChunks } from "../queryChunks.js";
import { generateOpenRouter } from "../services/openRouterClient.js";
import { generateGemini } from "../services/geminiClient.js";

async function runFullTest() {

  console.log("⚡ Running full system test...\n");

  try {

    const sessionId = "test_session_001";

    /* ================= MEMORY TEST ================= */

    const history = await memoryService.getHistory(sessionId);

    console.log(`✅ Chat memory messages: ${history.length}`);

    /* ================= VECTOR STORE TEST ================= */

    const query = "AI marketing systems";

    const topChunks = await getTopChunks(query, 8, 0.15);

    console.log(`✅ Vector store results: ${topChunks.length}`);

    console.log(`Top chunks for "${query}":`);

    topChunks.slice(0,5).forEach(c => {

      console.log(
        `  - ${c.source ?? "unknown"} (score: ${c.score?.toFixed(3) ?? "n/a"})`
      );

    });

    /* ================= QWEN TEST ================= */

    console.log("\n🚀 Testing Qwen (OpenRouter)...");

    try {

      const qwenResponse = await generateOpenRouter(
        "Explain AI marketing systems in simple terms"
      );

      console.log(
        "✅ Qwen response:",
        qwenResponse.slice(0,200),
        qwenResponse.length > 200 ? "..." : ""
      );

    } catch (err:any) {

      console.error("❌ Qwen test failed:", err.message || err);

    }

    /* ================= GEMINI TEST ================= */

    console.log("\n✨ Testing Gemini fallback...");

    try {

      const geminiResponse = await generateGemini(
        "Explain AI marketing systems in simple terms"
      );

      console.log(
        "✅ Gemini response:",
        geminiResponse.slice(0,200),
        geminiResponse.length > 200 ? "..." : ""
      );

    } catch (err:any) {

      console.error("❌ Gemini test failed:", err.message || err);

    }

    console.log("\n🎉 Full system test completed successfully.");

  } catch (err:any) {

    console.error("❌ Full system test failed:", err.message || err);

    process.exit(1);

  }

}

runFullTest();
