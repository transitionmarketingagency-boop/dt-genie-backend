export function isBookingIntent(message: string): boolean {
  if (!message || typeof message !== "string") return false;

  const msg = message.toLowerCase().trim();

  // =============================
  // 1. STRONG BOOKING INTENT (HIGHEST PRIORITY)
  // =============================
  const strongPatterns = [
    "book a call",
    "schedule a call",
    "book a meeting",
    "schedule a meeting",
    "set up a call",
    "set up a meeting",
    "let's schedule a call",
    "i want to book a call",
    "i want to schedule a call",
    "can we schedule a call",
    "can i book a call",
    "i want to talk",
    "let’s talk",
    "book a strategy call",
    "schedule a strategy call",
    "get on a call",
  ];

  if (strongPatterns.some(p => msg.includes(p))) {
    return true;
  }

  // =============================
  // 2. REJECTION SIGNALS (HIGHEST PRIORITY BLOCK)
  // =============================
  const rejectionSignals = [
    "later",
    "not now",
    "maybe later",
    "just exploring",
    "just checking",
    "not ready",
    "no need",
    "not interested",
    "stop",
    "don’t want",
    "dont want",
  ];

  if (rejectionSignals.some(p => msg.includes(p))) {
    return false;
  }

  // =============================
  // 3. STRICT CONTEXT BLOCKING (IMPORTANT FIX)
  // =============================
  const nonBookingContexts = [
    "cold call",
    "cold calling",
    "sales call",
    "call center",
    "call tracking",
    "api call",
    "function call",
    "phone call",
    "zoom call issue",
    "call logs",
    "call recording",
    "book summary",
    "reading a book",
  ];

  if (nonBookingContexts.some(p => msg.includes(p))) {
    return false;
  }

  // =============================
  // 4. SOFT INTENT DETECTION (CONTROLLED)
  // =============================
  const softSignals = [
    "book",
    "schedule",
    "call",
    "meeting",
    "talk",
    "connect",
  ];

  const hasSoftSignal = softSignals.some(word => msg.includes(word));

  if (!hasSoftSignal) return false;

  // =============================
  // 5. CONTEXT VALIDATION (ANTI-SPAM FIX)
  // =============================
  const validIntentPatterns = [
    /book.*call/,
    /schedule.*call/,
    /call.*strategy/,
    /talk.*call/,
    /schedule.*meeting/,
    /book.*meeting/,
  ];

  const matchesPattern = validIntentPatterns.some(regex => regex.test(msg));

  return matchesPattern;
}
