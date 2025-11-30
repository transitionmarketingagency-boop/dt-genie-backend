// server/test-backend.ts

async function testBackend() {
  const baseUrl = "http://127.0.0.1:5000";

  try {
    // 1️⃣ Test Gemini reply
    const geminiRes = await fetch(`${baseUrl}/test-gemini`);
    const geminiData = await geminiRes.json();
    console.log("🚀 Gemini Response:", geminiData);

    // 2️⃣ Test memory and chat history
    // Optional endpoints if implemented
    try {
      const memoryRes = await fetch(`${baseUrl}/memory`);
      const memoryData = await memoryRes.json();
      console.log("🧠 Memory Data:", memoryData);
    } catch {
      console.log("🧠 Memory endpoint not implemented. Skipping.");
    }

    try {
      const historyRes = await fetch(`${baseUrl}/history`);
      const historyData = await historyRes.json();
      console.log("📜 Chat History:", historyData);
    } catch {
      console.log("📜 History endpoint not implemented. Skipping.");
    }
  } catch (err) {
    console.error("❌ Backend test failed:", err);
  }
}

testBackend();

