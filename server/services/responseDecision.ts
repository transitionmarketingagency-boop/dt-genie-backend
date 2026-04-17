/* =====================================================
   RESPONSE DECISION (FINAL STABLE VERSION)
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
  if (typeof message !== "string") return false;

  const msg = normalize(message);

  return /(not now|dont want|don't want|later|no thanks|stop|just exploring|not interested|maybe later|busy)/i.test(
    msg
  );
}

/* ================= WEAK / LOW INTENT ================= */
function isWeakMessage(message: string): boolean {
  const msg = normalize(message);

  if (!msg) return true;

  if (msg.length < 4) return true;

  if (/^(hi|hello|hey|yo|ok|yes|no|thanks|cool)$/i.test(msg)) return true;

  return false;
}

/* ================= INFORMATIONAL FILTER ================= */
function isInformational(message: string): boolean {
  const msg = normalize(message);

  return /(what|why|how|explain|tell me|guide|learn|difference)/i.test(msg);
}

/* ================= HIGH INTENT (FIXED) ================= */
function isHighIntent(message: string): boolean {
  const msg = normalize(message);

  return /(hire|book|schedule|call|let's start|start working|i want to proceed|get started|work with you|i'm ready)/i.test(
    msg
  );
}

/* ================= CTA ENGINE ================= */
export function shouldIncludeCTA(
  message: string,
  intentCategories: string[] = [],
  leadScore: number = 0,
  stage: string = "discovery"
): boolean {
  const msg = normalize(message);

  /* ---------- HARD BLOCKS ---------- */
  if (detectBookingRejection(msg)) return false;

  if (isWeakMessage(msg)) return false;

  /* ❌ prevent spam CTA loops */
  if (msg.includes("clarify your main goal")) return false;

  /* ---------- INFORMATIONAL GUARD ---------- */
  if (isInformational(msg) && leadScore < 0.6) return false;

  /* ---------- HIGH INTENT PRIORITY ---------- */
  if (isHighIntent(msg)) return true;

  /* ---------- INTENT CATEGORY BOOST ---------- */
  if (intentCategories.includes("buying") && leadScore >= 0.5) {
    return true;
  }

  /* ---------- STAGE + SCORE ---------- */
  if (stage === "conversion" && leadScore >= 0.5) return true;

  if (stage === "service" && leadScore >= 0.65) return true;

  if (stage === "strategy" && leadScore >= 0.75) return true;

  return false;
}
