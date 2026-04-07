export function neuralBrain(message: string) {
  const msg = message.trim().toLowerCase();
  const greetingRegex = /^(hi|hello|hey|good morning|good afternoon|good evening)$/i;

  // Strong booking intent
  if (/(book|schedule|appointment|consultation|call|hire|work with you|start now|let's start|ready to proceed)/i.test(msg)) {
    return { type: "booking" };
  }

  if (msg.includes("who are you")) {
    return { type: "identity" };
  }

  // Greeting only if very short (prevents spam)
  if (greetingRegex.test(msg) && msg.split(" ").length <= 3) {
    return { type: "greeting" };
  }

  return { type: "normal" };
}
