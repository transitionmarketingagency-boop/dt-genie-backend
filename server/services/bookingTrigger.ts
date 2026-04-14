/* ================= TYPES ================= */
export type Stage =
  | "greeting"
  | "discovery"
  | "strategy"
  | "service"
  | "conversion";

/* ================= COOLDOWN ================= */
const BOOKING_COOLDOWN_MS = 1000 * 60 * 5; // 5 min
const bookingCooldownMap = new Map<string, number>();

function cleanupCooldowns(): void {
  const now = Date.now();

  for (const [key, ts] of bookingCooldownMap.entries()) {
    if (now - ts > 1000 * 60 * 60) {
      bookingCooldownMap.delete(key); // cleanup after 1 hour
    }
  }
}

function isInCooldown(sessionId: string): boolean {
  if (!sessionId) return false;

  const last = bookingCooldownMap.get(sessionId);
  if (!last) return false;

  return Date.now() - last < BOOKING_COOLDOWN_MS;
}

function markTriggered(sessionId: string): void {
  if (!sessionId) return;
  bookingCooldownMap.set(sessionId, Date.now());
}

/* ================= NORMALIZE ================= */
function normalize(text: string): string {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/* ================= MAIN TRIGGER LOGIC ================= */
export async function shouldTriggerBooking(
  sessionId: string,
  stage: Stage,
  leadScore: number = 0,
  message: string = ""
): Promise<boolean> {
  try {
    cleanupCooldowns();

    if (!sessionId || typeof sessionId !== "string") return false;

    const msg = normalize(message);

    /* ---------- COOLDOWN CHECK ---------- */
    if (isInCooldown(sessionId)) return false;

    /* ---------- LOW INTENT FILTER ---------- */
    const informationalWords = [
      "what",
      "why",
      "how",
      "explain",
      "tell me",
      "guide",
      "learn",
    ];

    const isInformational = informationalWords.some((w) =>
      msg.includes(w)
    );

    if (isInformational && leadScore < 0.6) return false;

    /* ---------- REJECTION FILTER ---------- */
    const rejectionPhrases = [
      "not now",
      "later",
      "just exploring",
      "no thanks",
      "dont want",
      "don't want",
      "stop",
    ];

    if (rejectionPhrases.some((r) => msg.includes(r))) return false;

    /* ---------- STRONG BUYING SIGNALS ---------- */
    const strongIntentSignals = [
      "hire",
      "work with you",
      "get started",
      "start working",
      "let's start",
      "im ready",
      "i am ready",
      "i want to proceed",
      "book",
      "schedule",
      "call",
      "consultation",
    ];

    const hasStrongIntent =
      strongIntentSignals.some((w) => msg.includes(w)) && msg.length > 8;

    if (hasStrongIntent) {
      markTriggered(sessionId);
      return true;
    }

    /* ---------- STAGE-BASED TRIGGERS ---------- */
    const stageTriggers =
      (stage === "conversion" && leadScore >= 0.5) ||
      (stage === "service" && leadScore >= 0.65) ||
      (stage === "strategy" && leadScore >= 0.75);

    if (stageTriggers) {
      markTriggered(sessionId);
      return true;
    }

    return false;
  } catch (err) {
    console.error("[BookingTrigger] Error:", err);
    return false;
  }
}
