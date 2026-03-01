// server/populate-test-data.ts

import { memoryService } from "./services/memoryService.js";
import { ConversationMemory, ChatMessage } from "../shared/types.js";

export default async function populateTestData() {
  const sessionId = "default-session";

  // Check if any existing messages
  const existingHistory: ChatMessage[] = await memoryService.getHistory(sessionId);

  if (!existingHistory.length) {
    const testMessages: ChatMessage[] = [
      { id: crypto.randomUUID(), sessionId, role: "user", content: "Hi, I want to start email campaigns for XCGI clients.", timestamp: new Date() },
      { id: crypto.randomUUID(), sessionId, role: "assistant", content: "Great! Let’s draft a campaign targeting luxury real estate developers.", timestamp: new Date() },
      { id: crypto.randomUUID(), sessionId, role: "user", content: "Also, can we create a test memory for this chat?", timestamp: new Date() },
      { id: crypto.randomUUID(), sessionId, role: "assistant", content: "Absolutely — I can populate memory with your preferences and current projects.", timestamp: new Date() },
    ];

    for (const msg of testMessages) {
      await memoryService.addMessage(msg.sessionId, msg.role, msg.content);
    }

    console.log("✅ Test chat history inserted!");
  } else {
    console.log("ℹ️ Chat history already exists. Skipping insertion.");
  }

  const testMemory: ConversationMemory[] = [
    {
      id: "mem1",
      conversationId: sessionId,
      key: "user_name",
      value: "Digital Transition Marketing",
      source: "manual",
      chunk: "User's company name",
      created_at: new Date().toISOString(),
      timestamp: new Date(),
    },
    {
      id: "mem2",
      conversationId: sessionId,
      key: "preferred_niches",
      value: ["real estate", "technology", "travel", "e-commerce"],
      source: "manual",
      chunk: "User’s preferred business niches",
      created_at: new Date().toISOString(),
      timestamp: new Date(),
    },
    {
      id: "mem3",
      conversationId: sessionId,
      key: "current_focus",
      value: "CGI property tours & AI marketing",
      source: "manual",
      chunk: "User’s current project focus",
      created_at: new Date().toISOString(),
      timestamp: new Date(),
    },
  ];

  for (const mem of testMemory) {
    await memoryService.addMessage(sessionId, "user", JSON.stringify(mem));
  }

  console.log("✅ Test memory inserted!");
}
