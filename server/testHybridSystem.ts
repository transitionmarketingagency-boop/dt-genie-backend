// server/testHybridSystem.ts
import { generateHybridResponse } from "./services/hybridClient.js";

/**
 * Test queries
 */
const testQueries = [
  {
    type: "simple",
    query: "What services does Digital Transition Marketing offer?"
  },
  {
    type: "complex",
    query: "Create a full marketing automation strategy with funnels, CRM, and AI"
  },
  {
    type: "simple",
    query: "Tell me about pricing for your services."
  },
  {
    type: "complex",
    query: "Analyze and optimize a social media campaign for engagement."
  }
];

(async () => {
  console.log("=== Hybrid AI System Test Started ===\n");

  for (const { type, query } of testQueries) {
    try {
      console.log(`--- Testing ${type.toUpperCase()} Query ---`);
      console.log("Prompt:", query);

      const start = Date.now();
      const response = await generateHybridResponse(query);
      const duration = ((Date.now() - start) / 1000).toFixed(2);

      console.log("Response:", response);
      console.log("Time taken:", duration, "s\n");
    } catch (err) {
      console.error("Error generating response:", err);
    }
  }

  console.log("=== All Tests Completed ===");
})();
