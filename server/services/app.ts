// server/services/app.ts

import type { ChatMessage } from "@shared/schema";
import { storage } from "../storage";
import { generateResponse } from "./gemini";

/**
 * processUserMessage
 * Handles incoming user messages, stores them,
 * calls the LLM, and returns updated conversation history.
 */
export async function processUserMessage(
  sessionId: string,
  userMessage: string
): Promise<ChatMessage[]> {
  // Save user message
  await storage.addChatMessage({
    role: "user",
    content: userMessage,
    sessionId
  });

  // Generate assistant response
  const aiResponse = await generateResponse(sessionId, userMessage);

  // Save assistant response
  await storage.addChatMessage({
    role: "assistant",
    content: aiResponse,
    sessionId
  });

  // Return updated chat history
  return storage.getChatHistory(sessionId);
}
