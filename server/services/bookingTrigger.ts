// server/services/bookingTrigger.ts

/* ================= TYPES ================= */
type Stage = "greeting" | "discovery" | "strategy" | "service" | "conversion";

/* ================= COOLDOWN ================= */
const BOOKING_COOLDOWN_MS = 1000 * 60 * 5; // 5 min
const bookingCooldownMap = new Map<string, number>();

function isInCooldown(sessionId: string): boolean {
  const last = bookingCooldownMap.get(sessionId);
  return last ? Date.now() - last < BOOKING_COOLDOWN_MS : false;
}

function markTriggered(sessionId: string) {
  bookingCooldownMap.set(sessionId, Date.now());
}

/* ================= NORMALIZE ================= */
function normalize(text: string): string {
  return (text || "").toLowerCase().trim();
}

/* ================= MAIN TRIGGER LOGIC ================= */
export async function shouldTriggerBooking(
  sessionId: string,
  stage: Stage,
  leadScore: number = 0,
  message: string = ""
): Promise<boolean> {
  try {
    const msg = normalize(message);

    /* ---------- COOLDOWN GUARD ---------- */
    if (isInCooldown(sessionId)) return false;

    /* ---------- HARD BLOCK (LOW INTENT) ---------- */
    const isInformational =
      msg.includes("what") ||
      msg.includes("why") ||
      msg.includes("how") ||
      msg.includes("explain") ||
      msg.includes("tell me") ||
      msg.includes("guide") ||
      msg.includes("learn");

    if (isInformational && leadScore < 0.6) {
      return false;
    }

    /* ---------- REJECTION ---------- */
    const rejection =
      msg.includes("not now") ||
      msg.includes("later") ||
      msg.includes("just exploring") ||
      msg.includes("no thanks") ||
      msg.includes("dont want") ||
      msg.includes("don't want");

    if (rejection) return false;

    /* ---------- STRONG BUYING SIGNALS ---------- */
    const strongIntent =
      msg.includes("hire") ||
      msg.includes("work with you") ||
      msg.includes("get started") ||
      msg.includes("start working") ||
      msg.includes("let's start") ||
      msg.includes("i want to proceed") ||
      msg.includes("i'm ready") ||
      msg.includes("book") ||
      msg.includes("schedule") ||
      msg.includes("call") ||
      msg.includes("consultation");

    if (strongIntent && msg.length > 8) {
      markTriggered(sessionId);
      return true;
    }

    /* ---------- STAGE + LEAD INTELLIGENCE ---------- */

    // 🔥 Conversion stage (high probability close)
    if (stage === "conversion" && leadScore >= 0.5) {
      markTriggered(sessionId);
      return true;
    }

    // 🔥 Service stage (strong mid-funnel intent)
    if (stage === "service" && leadScore >= 0.65) {
      markTriggered(sessionId);
      return true;
    }

    // 🔥 Strategy stage (only high-quality leads)
    if (stage === "strategy" && leadScore >= 0.75) {
      markTriggered(sessionId);
      return true;
    }

    /* ---------- DEFAULT ---------- */
    return false;

  } catch (err) {
    console.error("[BookingTrigger] Error:", err);
    return false;
  }
}
