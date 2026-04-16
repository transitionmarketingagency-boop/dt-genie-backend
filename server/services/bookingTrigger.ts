/* =====================================================
   BOOKING TRIGGER (PHASE 6 — PRODUCTION STABLE)
===================================================== */

/* ================= TYPES ================= */
export type Stage =
  | "greeting"
  | "discovery"
  | "strategy"
  | "service"
  | "conversion";

/* ================= COOLDOWN ================= */
const BOOKING_COOLDOWN_MS = 1000 * 60 * 5; // 5 min
const REJECTION_COOLDOWN_MS = 1000 * 60 * 10; // 10 min

const bookingCooldownMap = new Map<string, number>();
const rejectionMap = new Map<string, number>();

/* ================= CLEANUP ================= */
function cleanupCooldowns(): void {
  const now = Date.now();

  for (const [key, ts] of bookingCooldownMap.entries()) {
    if (now - ts > 1000 * 60 * 60) {
      bookingCooldownMap.delete(key);
    }
  }

  for (const [key, ts] of rejectionMap.entries()) {
    if (now - ts > 1000 * 60 * 60) {
      rejectionMap.delete(key);
    }
  }
}

/* ================= HELPERS ================= */
function normalize(text: string): string {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function isWeakMessage(msg: string): boolean {
  return !msg || msg.length < 4 || /^(hi|hello|hey|ok|yes|no)$/i.test(msg);
}

function isInformational(msg: string): boolean {
  return /(what|why|how|explain|tell me|guide|learn)/i.test(msg);
}

function isContextShift(msg: string): boolean {
  return /(i run|i have|my business|we are|new business|actually now)/i.test(
    msg
  );
}

function isStrongBuyingIntent(msg: string): boolean {
  return /(i want to hire|i want to work with you|let's start|ready to begin|how do we start|get started|book a call|schedule a call)/i.test(
    msg
  );
}

function isSoftBookingMention(msg: string): boolean {
  return /(book|schedule|call|consultation)/i.test(msg);
}

function isRejection(msg: string): boolean {
  return /(not now|later|just exploring|no thanks|dont want|don't want|stop|maybe later)/i.test(
    msg
  );
}

/* ================= STATE ================= */

function isInCooldown(sessionId: string): boolean {
  const last = bookingCooldownMap.get(sessionId);
  return last ? Date.now() - last < BOOKING_COOLDOWN_MS : false;
}

function isRejected(sessionId: string): boolean {
  const last = rejectionMap.get(sessionId);
  return last ? Date.now() - last < REJECTION_COOLDOWN_MS : false;
}

function markTriggered(sessionId: string): void {
  bookingCooldownMap.set(sessionId, Date.now());
}

function markRejected(sessionId: string): void {
  rejectionMap.set(sessionId, Date.now());
}

/* ================= MAIN ================= */

export async function shouldTriggerBooking(
  sessionId: string,
  stage: Stage,
  leadScore: number = 0,
  message: string = ""
): Promise<boolean> {
  try {
    cleanupCooldowns();

    if (!sessionId) return false;

    const msg = normalize(message);

    /* ---------- BASIC FILTERS ---------- */
    if (isWeakMessage(msg)) return false;

    /* ---------- REJECTION LOCK ---------- */
    if (isRejection(msg)) {
      markRejected(sessionId);
      return false;
    }

    if (isRejected(sessionId)) return false;

    /* ---------- CONTEXT SHIFT RESET ---------- */
    if (isContextShift(msg)) {
      // reset booking pressure on new context
      return false;
    }

    /* ---------- COOLDOWN ---------- */
    if (isInCooldown(sessionId)) return false;

    /* ---------- INFORMATIONAL GUARD ---------- */
    if (isInformational(msg) && leadScore < 0.7) return false;

    /* ---------- STRONG INTENT (ONLY SAFE TRIGGER) ---------- */
    if (isStrongBuyingIntent(msg)) {
      markTriggered(sessionId);
      return true;
    }

    /* ---------- SOFT INTENT BLOCK ---------- */
    if (isSoftBookingMention(msg) && leadScore < 0.8) {
      return false; // prevent premature triggers
    }

    /* ---------- STAGE + SCORE ---------- */
    const shouldTrigger =
      (stage === "conversion" && leadScore >= 0.6) ||
      (stage === "service" && leadScore >= 0.7) ||
      (stage === "strategy" && leadScore >= 0.8);

    if (shouldTrigger) {
      markTriggered(sessionId);
      return true;
    }

    return false;
  } catch (err) {
    console.error("[BookingTrigger] Error:", err);
    return false;
  }
}
