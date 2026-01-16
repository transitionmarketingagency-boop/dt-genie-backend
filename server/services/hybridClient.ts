// server/services/hybridClient.ts
import { generateHybridResponse } from "./generateHybridResponse.js";

/**
 * Thin compatibility wrapper.
 * DO NOT add logic here.
 */
export async function hybridClient(
  prompt: string,
  sessionId: string
): Promise<string> {
  return generateHybridResponse(prompt, sessionId);
}

// Backward compatibility
export { hybridClient as generateHybridResponse };

