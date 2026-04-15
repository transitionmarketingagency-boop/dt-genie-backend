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
      bookingCooldownMap.delete(key);
    }
  }
}

function isInCooldown(sessionId: string): boolean {
  const last = bookingCooldownMap.get(sessionId);
  return last ? Date.now() - last < BOOKING_COOLDOWN_MS : false;
}

function markTriggered(sessionId: string): void {
  bookingCooldownMap.set(sessionId, Date.now());
}

/* ================= NORMALIZE ================= */
function normalize(text: string): string {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
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

    /* ---------- COOLDOWN ---------- */
    if (isInCooldown(sessionId)) return false;

    /* ---------- REJECTION ---------- */
    if (
      /(not now|later|just exploring|no thanks|dont want|don't want|stop)/i.test(
        msg
      )
    ) {
      return false;
    }

    /* ---------- LOW INTENT FILTER ---------- */
    if (
      /(what|why|how|explain|tell me|guide|learn)/i.test(msg) &&
      leadScore < 0.6
    ) {
      return false;
    }

    /* ---------- STRONG BUYING INTENT ---------- */
    if (
      /(hire|start|work with you|get started|book|schedule|call|consultation)/i.test(
        msg
      ) &&
      msg.length > 8
    ) {
      markTriggered(sessionId);
      return true;
    }

    /* ---------- STAGE + SCORE LOGIC ---------- */
    const shouldTrigger =
      (stage === "conversion" && leadScore >= 0.5) ||
      (stage === "service" && leadScore >= 0.65) ||
      (stage === "strategy" && leadScore >= 0.75);

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
