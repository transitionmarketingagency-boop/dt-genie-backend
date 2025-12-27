import fetch from "node-fetch";

const BASE_URL = process.env.RENDER_URL || "http://localhost:5000";

// Sample test messages
const testMessages = [
  "Tell me about your services",
  "What makes your company different?",
  "How can I contact you?",
  "Do you offer training?",
];

async function runTest() {
  const sessionId = `test-${Date.now()}`;

  for (const message of testMessages) {
    const response = await fetch(`${BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId }),
    });

    const data = await response.json();
    console.log("User:", message);
    console.log("AI Reply:", data.reply, "\n");
  }

  console.log("✅ Test session completed:", sessionId);
}

runTest().catch(console.error);
