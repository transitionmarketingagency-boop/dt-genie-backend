/* =====================================================
   RESPONSE DECISION (ANTI-SPAM + HUMAN FLOW FIX v2)
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

  return /(not now|later|no thanks|dont want|don't want|just exploring|not interested|maybe later|busy|stop|leave me)/i.test(
    msg
  );
}

/* ================= LOW VALUE ================= */
function isWeakMessage(message: string): boolean {
  const msg = normalize(message);

  if (!msg) return true;
  if (msg.length < 4) return true;

  if (/^(hi|hello|hey|yo|ok|yes|no|hmm|thanks)$/i.test(msg)) return true;

  return false;
}

/* ================= INFORMATIONAL ================= */
function isInformational(message: string): boolean {
  const msg = normalize(message);

  return /(what|why|how|explain|tell me|guide|learn|difference|help)/i.test(msg);
}

/* ================= HIGH INTENT (FIXED STRONGER) ================= */
function isHighIntent(message: string): boolean {
  const msg = normalize(message);

  return (
    /(hire|start|book|schedule|work with you|get started|i want results|i'm ready)/i.test(
      msg
    ) ||
    /(pricing|cost|budget|roas|leads|ads not working|wasting money|not converting)/i.test(
      msg
    )
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

  /* ❌ Prevent repetitive informational spam triggers */
  if (
    msg === "what should we do" ||
    msg === "tell me more" ||
    msg === "explain"
  ) {
    return false;
  }

  /* ❌ STRONG informational guard (FIXED) */
  const informational = isInformational(msg);
  if (informational && leadScore < 0.7 && !isHighIntent(msg)) return false;

  /* ✅ HIGH INTENT ALWAYS WINS */
  if (isHighIntent(msg)) return true;

  /* ✅ STAGE LOGIC (FIXED SAFE GATING) */
  if (stage === "conversion" && leadScore >= 0.65) return true;

  if (stage === "service" && leadScore >= 0.7) return true;

  if (stage === "strategy" && leadScore >= 0.8) return true;

  /* ✅ INTENT CATEGORY BOOST */
  if (intentCategories?.length > 0 && leadScore >= 0.75) return true;

  /* ❌ DEFAULT BLOCK */
  return false;
}
