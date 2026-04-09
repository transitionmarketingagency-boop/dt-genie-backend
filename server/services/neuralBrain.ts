export function neuralBrain(message: string) {
  const msg = message.trim().toLowerCase();

  /* ---------------- GREETING ---------------- */
  if (/^(hi|hello|hey|yo|sup|good (morning|afternoon|evening))\b/.test(msg)) {
    return { type: "greeting", highIntent: false };
  }

  /* ---------------- IDENTITY ---------------- */
  if (
    /who are you|what do you do|about you|your company|what is digital transition marketing/i.test(
      msg
    )
  ) {
    return { type: "identity", highIntent: false };
  }

  /* ---------------- BOOKING ---------------- */
  if (
    /(book|schedule|appointment|consultation|call|hire|work with you|start now|ready to proceed)/i.test(
      msg
    )
  ) {
    return { type: "booking", highIntent: true };
  }

  /* ---------------- PROBLEM ---------------- */
  if (
    /(low roas|no conversions|ads not working|no sales|traffic but no leads|bad performance)/i.test(
      msg
    )
  ) {
    return { type: "problem", highIntent: true };
  }

  /* ---------------- SERVICE ---------------- */
  if (
    /(services|what do you offer|help with|seo|ads|ai marketing|automation|funnels)/i.test(
      msg
    )
  ) {
    return { type: "service_inquiry", highIntent: false };
  }

  /* ---------------- DEFAULT ---------------- */
  return { type: "normal", highIntent: false };
}
