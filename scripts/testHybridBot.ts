// scripts/testHybridBot.ts
import { generateHybridResponse } from "../server/services/generateHybridResponse.js";

const testQueries = [
  "hi",
  "who are you?",
  "tell me about your services",
  "tell me about CGI ads",
  "do you handle AI automation for agencies?",
  "guide me on e-commerce paid ads",
  "tell me about virtual property tours",
  "what are your niches and specialties?",
  "how do I schedule a strategy call?",
  "tell me about Digital Transition Marketing"
];

async function testBot() {
  console.log("=== Starting Hybrid AI Bot Test ===\n");
  for (const q of testQueries) {
    console.log(`\n---\nQuery: ${q}`);
    const start = Date.now();
    try {
      const response = await generateHybridResponse(q, "test-session");
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`Response (${duration}s):\n${response}`);
    } catch (err) {
      console.error("Error generating response:", err);
    }
  }
  console.log("\n=== Hybrid AI Bot Test Completed ===");
}

testBot();
