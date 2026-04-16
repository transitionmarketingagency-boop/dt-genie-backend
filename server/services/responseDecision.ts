/* =====================================================
   RESPONSE DECISION (FIXED PRODUCTION VERSION)
===================================================== */

/* ================= NORMALIZE ================= */
function normalize(text: string): string {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
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

  if (/^(hi|hello|hey|yo|ok|yes|no)$/i.test(msg)) return true;

  return false;
}

/* ================= INFORMATIONAL FILTER ================= */
function isInformational(message: string): boolean {
  const msg = normalize(message);

  return /(what|why|how|explain|tell me|guide|learn)/i.test(msg);
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

  if (/(who are you|what do you do)/i.test(msg)) return false;

  /* ---------- INFORMATIONAL GUARD ---------- */
  if (isInformational(msg) && leadScore < 0.6) return false;

  /* ---------- STRONG BUYING SIGNAL ---------- */
  const strongIntent =
    /(hire|start|work with you|book|schedule|call|let's start|i want to proceed|get started)/i.test(
      msg
    );

  if (strongIntent) return true;

  /* ---------- STAGE + SCORE (FIXED SCALE 0–1) ---------- */
  if (stage === "conversion" && leadScore >= 0.5) return true;

  if (stage === "service" && leadScore >= 0.65) return true;

  if (stage === "strategy" && leadScore >= 0.75) return true;

  return false;
}
