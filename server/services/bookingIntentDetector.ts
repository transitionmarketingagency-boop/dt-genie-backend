export function isBookingIntent(message: string): boolean {
  if (!message) return false;

  const msg = message.toLowerCase().trim();

  // =============================
  // 1. STRONG INTENT (DIRECT COMMANDS)
  // =============================
  const strongPatterns = [
    "book a call",
    "schedule a call",
    "book a meeting",
    "schedule a meeting",
    "let's schedule",
    "i want to book",
    "i want to schedule",
    "set up a call",
    "set up a meeting",
    "can we schedule",
    "can i book",
    "let’s talk",
    "i want to talk",
  ];

  if (strongPatterns.some(p => msg.includes(p))) {
    return true;
  }


// 🔥 NEW — TIME-BASED BOOKING INTENT
const timeBookingPatterns = [
  "reserve a spot",
  "book me for",
  "schedule me for",
  "tomorrow",
  "today",
  "4pm",
  "5pm",
];

if (
  timeBookingPatterns.some(p => msg.includes(p)) &&
  msg.length < 80
) {
  return true;
}

  // =============================
  // 2. WEAK WORD PRESENCE
  // =============================
  const weakWords = ["call", "book", "meeting"];

  const hasWeakWord = weakWords.some(w => msg.includes(w));

  if (!hasWeakWord) return false;

  // =============================
  // 3. FILTER NON-BOOKING CONTEXTS
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
    "call conversion",
    "zoom call issue",
    "book marketing",
    "book strategy",
    "reading a book",
  ];

  if (nonBookingContexts.some(p => msg.includes(p))) {
    return false;
  }


// ❌ REJECTION SIGNALS (CRITICAL)
const rejectionSignals = [
  "later",
  "not now",
  "maybe later",
  "just checking",
  "just exploring",
  "not ready",
  "no need",
];

if (rejectionSignals.some(p => msg.includes(p))) {
  return false;
}

  // =============================
  // 4. LENGTH CONTROL (CRITICAL)
  // =============================
  const wordCount = msg.split(/\s+/).length;

// ✅ allow natural sentences but still controlled
if (wordCount > 15) return false;

  // =============================
  // 5. INTENT SIGNAL CHECK
  // =============================
  const intentSignals = [
    "book",
    "schedule",
    "setup",
    "set up",
    "connect",
    "talk",
  ];

  const hasIntentSignal = intentSignals.some(w => msg.includes(w));

  return hasIntentSignal;
}
