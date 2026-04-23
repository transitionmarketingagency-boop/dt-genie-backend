 /* =====================================================
   RESPONSE DECISION (ANTI-SPAM + HUMAN FLOW FIX v3)
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

  return /^(hi|hello|hey|yo|ok|hmm|thanks)$/i.test(msg);
}

/* ================= INFORMATIONAL ================= */
function isInformational(message: string): boolean {
  const msg = normalize(message);

  // reduced aggression (FIXED)
  return /(explain|guide|learn|difference|help me understand)/i.test(msg);
}

/* ================= HIGH INTENT ================= */
function isHighIntent(message: string): boolean {
  const msg = normalize(message);

  return (
    /(hire|start|book|schedule|work with you|get started|i'm ready)/i.test(msg) ||
    /(ads not working|not converting|wasting money|low roas|no leads)/i.test(msg)
  );
}

/* ================= CATEGORY MATCH ================= */
function hasRelevantCategory(
  intentCategories: string[] = [],
  keywords: string[]
): boolean {
  const cats = intentCategories.map(c => normalize(c));

  return keywords.some(k =>
    cats.some(c => c.includes(normalize(k)))
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

  /* ❌ prevent micro queries */
  if (msg.length < 6) return false;

  /* ❌ informational suppression (FIXED) */
  if (
    isInformational(msg) &&
    leadScore < 0.72 &&
    !isHighIntent(msg)
  ) {
    return false;
  }

  /* ✅ HIGH INTENT ALWAYS WINS */
  if (isHighIntent(msg)) return true;

  /* ✅ STAGE BASED LOGIC (tightened) */
  if (stage === "conversion" && leadScore >= 0.7) return true;
  if (stage === "strategy" && leadScore >= 0.78) return true;
  if (stage === "service" && leadScore >= 0.82) return true;

  /* ✅ CATEGORY INTENT MATCH (IMPROVED) */
  if (
    intentCategories?.length > 0 &&
    leadScore >= 0.78 &&
    hasRelevantCategory(intentCategories, ["service", "ads", "automation", "seo"])
  ) {
    return true;
  }

  /* ❌ DEFAULT */
  return false;
}
