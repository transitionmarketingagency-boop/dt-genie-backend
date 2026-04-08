/**
 * Neural-like brain for intent classification.
 * Detects booking, identity, greetings, service inquiries, and normal inputs.
 */
export function neuralBrain(message: string) {
  const msg = message.trim().toLowerCase();

  // Booking intent detection
  if (/(book|schedule|appointment|consultation|call|hire|work with you|start now|let's start|ready to proceed)/i.test(msg)) {
    return { type: "booking", highIntent: true };
  }

  // Identity / company info
  if (/who are you|what do you do/i.test(msg)) {
    return { type: "identity" };
  }

  // Greeting detection
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)/i.test(msg)) {
    return { type: "greeting" };
  }

  // Service inquiry detection
  if (/.*(help with|assist me|recommend services|services|offerings|solutions|SEO|AI marketing).*/i.test(msg)) {
    return { type: "service_inquiry", highIntent: false };
  }

  // Default
  return { type: "normal", highIntent: false };
}
