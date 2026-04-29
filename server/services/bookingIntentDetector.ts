export function isBookingIntent(message: string): boolean {
  if (!message) return false;

  const msg = message.toLowerCase().trim();

  // =============================
  // ❌ NEGATIVE CONTEXT (BLOCK FALSE TRIGGERS)
  // =============================
  const negativeContexts = [
    "call my team",
    "call the team",
    "api",
    "function",
    "code",
    "bookkeeping",
    "call center",
    "phone",
    "callback",
    "support call",
  ];

  if (negativeContexts.some(p => msg.includes(p))) {
    return false;
  }

  // =============================
  // ✅ STRONG BOOKING INTENT
  // =============================
  const strongPatterns = [
    /book (a )?(call|meeting)/,
    /schedule (a )?(call|meeting)/,
    /set up (a )?(call|meeting)/,
    /let'?s (talk|connect)/,
    /i want to (talk|speak|connect)/,
    /can we (talk|connect)/,
    /speak with you/,
  ];

  if (strongPatterns.some(p => p.test(msg))) {
    return true;
  }

  // =============================
  // ⚠️ WEAK WORDS (NEED CONTEXT)
  // =============================
  const weakWords = ["call", "book", "schedule", "meeting", "talk"];

  const hasWeakWord = weakWords.some(w => msg.includes(w));

  if (!hasWeakWord) return false;

  // =============================
  // 🧠 CONTEXT CHECK (ANTI-SPAM)
  // =============================
  const intentSignals = [
    "you",
    "with you",
    "with someone",
    "with your team",
    "discuss",
    "about this",
    "regarding",
  ];

  const hasIntentSignal = intentSignals.some(w => msg.includes(w));

  const wordCount = msg.split(/\s+/).length;

  // Require enough context to avoid spam triggers
  if (hasIntentSignal && wordCount >= 3) {
    return true;
  }

  return false;
}
