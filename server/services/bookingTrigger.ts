/* ================= TYPES ================= */
export type Stage = "greeting" | "discovery" | "strategy" | "service" | "conversion";

/* ================= COOLDOWN ================= */
const BOOKING_COOLDOWN_MS = 1000 * 60 * 5; // 5 min
const bookingCooldownMap = new Map<string, number>();

function cleanupCooldowns() {
  const now = Date.now();
  for (const [key, ts] of bookingCooldownMap.entries()) {
    if (now - ts > 1000 * 60 * 60) bookingCooldownMap.delete(key); // 1h cleanup
  }
}

function isInCooldown(sessionId: string): boolean {
  if (!sessionId) return false;
  const last = bookingCooldownMap.get(sessionId);
  return last ? Date.now() - last < BOOKING_COOLDOWN_MS : false;
}

function markTriggered(sessionId: string) {
  if (!sessionId) return;
  bookingCooldownMap.set(sessionId, Date.now());
}

/* ================= NORMALIZE ================= */
function normalize(text: string) {
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

    const msg = normalize(message);
    if (!sessionId) return false;

    if (isInCooldown(sessionId)) return false;

    // Low-intent informational check
    const informational = ["what", "why", "how", "explain", "tell me", "guide", "learn"];
    if (informational.some((w) => msg.includes(w)) && leadScore < 0.6) return false;

    // Explicit rejection phrases
    const rejection = ["not now", "later", "just exploring", "no thanks", "dont want", "don't want"];
    if (rejection.some((r) => msg.includes(r))) return false;

    // Strong buying signals
    const strongIntent = [
      "hire",
      "work with you",
      "get started",
      "start working",
      "let's start",
      "i want to proceed",
      "i'm ready",
      "book",
      "schedule",
      "call",
      "consultation"
    ];
    if (strongIntent.some((w) => msg.includes(w)) && msg.length > 8) {
      markTriggered(sessionId);
      return true;
    }

    // Stage-based thresholds
    if ((stage === "conversion" && leadScore >= 0.5) ||
        (stage === "service" && leadScore >= 0.65) ||
        (stage === "strategy" && leadScore >= 0.75)) {
      markTriggered(sessionId);
      return true;
    }

    return false;
  } catch (err) {
    console.error("[BookingTrigger] Error:", err);
    return false;
  }
}
