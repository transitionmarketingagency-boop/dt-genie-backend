/**
 * Neural-like brain for intent classification.
 * Improved: better real-world detection + removes rigid patterns
 */
export function neuralBrain(message: string) {
  const msg = message.trim().toLowerCase();

  /* ---------------- GREETING ---------------- */
  if (/^(hi|hello|hey|yo|sup|good (morning|afternoon|evening))\b/.test(msg)) {
    return { type: "greeting", highIntent: false };
  }

  /* ---------------- IDENTITY ---------------- */
  if (
    /who are you|what (do you do|is this)|your company|about you|what is digital transition marketing/i.test(
      msg
    )
  ) {
    return { type: "identity", highIntent: false };
  }

  /* ---------------- BOOKING / HIGH INTENT ---------------- */
  if (
    /(book|schedule|appointment|consultation|call|hire|work with you|start now|let's start|ready to proceed|scale this for me)/i.test(
      msg
    )
  ) {
    return { type: "booking", highIntent: true };
  }

  /* ---------------- PROBLEM AWARE (CRITICAL FIX) ---------------- */
  if (
    /(low roas|no conversions|not converting|bad results|no sales|traffic but no leads|ads not working|poor performance)/i.test(
      msg
    )
  ) {
    return { type: "problem", highIntent: true };
  }

  /* ---------------- SERVICE INQUIRY ---------------- */
  if (
    /(services|what do you offer|help with|assist me|solutions|seo|ai marketing|ads|cgi|automation|funnels)/i.test(
      msg
    )
  ) {
    return { type: "service_inquiry", highIntent: false };
  }

  /* ---------------- DEFAULT ---------------- */
  return { type: "normal", highIntent: false };
}
