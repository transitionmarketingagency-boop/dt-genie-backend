/* =====================================================
   RESPONSE DECISION (ANTI-SPAM + HUMAN FLOW FIX)
===================================================== */

/* ================= NORMALIZE ================= */
function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/* ================= REJECTION ================= */
export function detectBookingRejection(message: string): boolean {
  const msg = normalize(message);

  return /(not now|later|no thanks|dont want|don't want|just exploring|not interested|maybe later|busy)/i.test(
    msg
  );
}

/* ================= LOW VALUE ================= */
function isWeakMessage(message: string): boolean {
  const msg = normalize(message);

  if (!msg) return true;

  if (msg.length < 4) return true;

  if (/^(hi|hello|hey|yo|ok|yes|no|hmm)$/i.test(msg)) return true;

  return false;
}

/* ================= INFORMATIONAL ================= */
function isInformational(message: string): boolean {
  const msg = normalize(message);

  return /(what|why|how|explain|tell me|guide|learn|difference)/i.test(msg);
}

/* ================= HIGH INTENT ================= */
function isHighIntent(message: string): boolean {
  const msg = normalize(message);

  return /(hire|start|book|schedule|work with you|i want results|i'm ready|get started)/i.test(
    msg
  );
}

/* ================= CTA CONTROL ================= */
export function shouldIncludeCTA(
  message: string,
  intentCategories: string[] = [],
  leadScore: number = 0,
  stage: string = "discovery"
): boolean {
  const msg = normalize(message);

  /* ❌ HARD BLOCKS */
  if (detectBookingRejection(msg)) return false;

  if (isWeakMessage(msg)) return false;

  /* ❌ Prevent repetition spam */
  if (
    msg.includes("what should we do") ||
    msg.includes("tell me more") ||
    msg.includes("explain")
  ) {
    return false;
  }

  /* ❌ Informational guard */
  if (isInformational(msg) && leadScore < 0.65) return false;

  /* ✅ High intent always wins */
  if (isHighIntent(msg)) return true;

  /* ✅ Stage-based logic */
  if (stage === "conversion") return true;

  if (stage === "service" && leadScore >= 0.7) return true;

  if (stage === "strategy" && leadScore >= 0.8) return true;

  return false;
}
