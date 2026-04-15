/* ================= REJECTION ================= */
export function detectBookingRejection(message: string): boolean {
  if (typeof message !== "string") return false;

  return /(not now|dont want|don't want|later|no thanks|stop|just exploring|not interested)/i.test(
    message
  );
}

/* ================= CTA ENGINE ================= */
export function shouldIncludeCTA(
  message: string,
  intentCategories: string[] = [],
  leadScore: number = 0,
  stage: string = "discovery"
): boolean {
  const msg = (message || "").toLowerCase();

  /* ---------- BLOCKERS ---------- */
  if (detectBookingRejection(msg)) return false;

  if (/^(hi|hello|hey)$/.test(msg)) return false;

  if (/(who are you|what do you do)/i.test(msg)) return false;

  /* ---------- STRONG INTENT ---------- */
  if (
    /(hire|start|work with you|book|schedule|call|let's start)/i.test(msg)
  ) {
    return true;
  }

  /* ---------- STAGE + SCORE ---------- */
  if (stage === "conversion" && leadScore >= 0.5) return true;

  if (stage === "service" && leadScore >= 0.6) return true;

  if (stage === "strategy" && leadScore >= 0.75) return true;

  return false;
}
