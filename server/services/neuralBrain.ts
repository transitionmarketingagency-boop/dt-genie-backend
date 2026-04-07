// server/services/neuralBrain.ts

/**
 * Quick neural-like brain for intent classification.
 * Handles booking, identity queries, greetings, and normal inputs.
 */
export function neuralBrain(message: string) {
  const msg = message.trim().toLowerCase();
  const greetingRegex = /^(hi|hello|hey|good morning|good afternoon|good evening)$/i;

  // Strong booking intent detection
  if (/(book|schedule|appointment|consultation|call|hire|work with you|start now|let's start|ready to proceed)/i.test(msg)) {
    return { type: "booking" };
  }

  // Identity / company info queries
  if (msg.includes("who are you") || msg.includes("what do you do")) {
    return { type: "identity" };
  }

  // Greeting only if very short (prevents spam on long service queries)
  if (greetingRegex.test(msg) && msg.split(" ").length <= 3) {
    return { type: "greeting" };
  }

  // Default normal classification
  return { type: "normal" };
}
