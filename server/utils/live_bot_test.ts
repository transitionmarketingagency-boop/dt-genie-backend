// server/utils/live_bot_test.ts

import { generateHybridResponse } from "../services/generateHybridResponse.js";
import { memoryService } from "../services/memoryService.js";

const TEST_QUERIES = [
  "How many services do you offer?",
  "Explain AI marketing systems",
  "What is your SEO service?",
  "Tell me about your CGI property tours",
  "How do you handle analytics and growth tracking?",
  "Can you explain voice search optimization?",
  "What are your performance advertising capabilities?",
  "How do you personalize campaigns for clients?",
  "Explain your scalable growth strategies",
  "How does Neon Vision use AI in marketing?"
];

(async () => {
  console.log("⚡ Running FULL HYBRID BOT test...\n");

  const sessionId = "live_test_session";

  for (const query of TEST_QUERIES) {
    console.log(`🔹 Query: "${query}"`);

    const historyBefore = await memoryService.getHistory(sessionId);
    console.log(`Chat memory messages before: ${historyBefore.length}`);

    try {
      const response = await generateHybridResponse(query, sessionId);

      console.log(
        "Final Bot Response:",
        response.slice(0, 400) + (response.length > 400 ? "..." : "")
      );
    } catch (err: any) {
      console.error("Hybrid test failed:", err.message || err);
    }

    const historyAfter = await memoryService.getHistory(sessionId);
    console.log(`Chat memory messages after: ${historyAfter.length}\n`);
  }

  console.log("✅ Hybrid bot test complete.");
})();
