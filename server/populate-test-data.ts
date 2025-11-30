import { storage } from "./storage.ts";
import { memoryStore } from "./services/memory.ts";

export default async function populateTestData() {
  const sessionId = "default-session";

  // -------------------- HISTORY --------------------
  const existingHistory = await storage.getChatHistory?.(sessionId);
  if (!existingHistory || existingHistory.length === 0) {
    const testMessages = [
      {
        sessionId,
        role: "user",
        content: "Hi, I want to start email campaigns for XCGI clients."
      },
      {
        sessionId,
        role: "assistant",
        content: "Great! Let’s draft a campaign targeting luxury real estate developers."
      },
      {
        sessionId,
        role: "user",
        content: "Also, can we create a test memory for this chat?"
      },
      {
        sessionId,
        role: "assistant",
        content: "Absolutely — I can populate memory with your preferences and current projects."
      }
    ];

    const fullMessages = [];
    for (const msg of testMessages) {
      const saved = await storage.addChatMessage(msg);
      fullMessages.push(saved);
    }
    await storage.saveChatHistory(sessionId, fullMessages);
    console.log("✅ Test chat history inserted!");
  } else {
    console.log("ℹ️ Chat history already exists. Skipping insertion.");
  }

  // -------------------- MEMORY --------------------
  const existingMemory = memoryStore.getAllMemory?.() || [];
  const testMemoryKeys = ["mem1", "mem2", "mem3"];
  const memoryAlreadyInserted = existingMemory.some(m => testMemoryKeys.includes(m.id));

  if (!memoryAlreadyInserted) {
    const testMemory = [
      {
        id: "mem1",
        key: "user_name",
        value: "Digital Transition Marketing",
        source: "manual",
        chunk: "User's company name",
        created_at: new Date().toISOString()
      },
      {
        id: "mem2",
        key: "preferred_niches",
        value: ["real estate", "technology", "travel", "e-commerce"],
        source: "manual",
        chunk: "User’s preferred business niches",
        created_at: new Date().toISOString()
      },
      {
        id: "mem3",
        key: "current_focus",
        value: "CGI property tours & AI marketing",
        source: "manual",
        chunk: "User’s current project focus",
        created_at: new Date().toISOString()
      }
    ];

    testMemory.forEach(entry => memoryStore.addMemory?.(entry));
    console.log("✅ Test memory inserted!");
  } else {
    console.log("ℹ️ Test memory already exists. Skipping insertion.");
  }
}



