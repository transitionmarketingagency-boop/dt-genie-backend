import { generateHybridResponse } from "../services/generateHybridResponse.js";

const testCases = [
  { message: "Hi", description: "Greeting" },
  { message: "Who are you?", description: "Identity" },
  { message: "I want to book a call", description: "Booking" },
  { message: "List all services", description: "Service listing" },
  { message: "Tell me about AI content creation", description: "Embedding knowledge" },
  { message: "Explain performance marketing packages", description: "JSON intent match" }
];

(async () => {
  for (const t of testCases) {
    const response = await generateHybridResponse(t.message, "test-session");
    console.log(`\n[${t.description}] Input: ${t.message}\nResponse:\n${JSON.stringify(response, null, 2)}\n`);
  }
})();
