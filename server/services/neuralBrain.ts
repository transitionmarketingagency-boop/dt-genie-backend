export function neuralBrain(message: string) {
  const msg = message.trim().toLowerCase();

  /* ================= CONTEXT DETECTION ================= */
  const businessSignals = /(ecommerce|store|shopify|real estate|travel|agency|startup|business)/i.test(msg);

  /* ================= GREETING ================= */
  if (
    /^(hi|hello|hey|yo|sup|good (morning|afternoon|evening))\b/.test(msg)
  ) {
    return {
      type: "greeting",
      highIntent: false,
      confidence: 0.95,
    };
  }

  /* ================= IDENTITY ================= */
  if (
    /who are you|what do you do|about you|your company|what is digital transition marketing/i.test(
      msg
    )
  ) {
    return {
      type: "identity",
      highIntent: false,
      confidence: 0.9,
    };
  }


/* ================= BOOKING / HIGH INTENT (FIXED) ================= */
const bookingMatch = /(book\s+(a\s+)?call|schedule\s+(a\s+)?call|book\s+(a\s+)?meeting|schedule\s+(a\s+)?meeting|i want to (book|schedule)|let'?s schedule|can we schedule|get on a call|talk to (someone|team))/i.test(msg);

if (bookingMatch) {
  return {
    type: "booking",
    highIntent: true,
    confidence: 0.98,
  };
}

  /* ================= PROBLEM DETECTION ================= */
  const problemMatch = /(low roas|no conversions|ads not working|no sales|traffic but no leads|bad performance|struggling|not working|issue|problem)/i.test(
    msg
  );

  if (problemMatch) {
    return {
      type: "problem",
      highIntent: true,
      confidence: 0.95,
      businessContext: businessSignals,
    };
  }

  /* ================= SERVICE INQUIRY ================= */
  const serviceMatch = /(services|what do you offer|help with|seo|ads|ai marketing|automation|funnels|solutions|cgi|virtual tour)/i.test(
    msg
  );

  if (serviceMatch) {
    return {
      type: "service_inquiry",
      highIntent: false,
      confidence: 0.85,
      businessContext: businessSignals,
    };
  }

  /* ================= MIXED INTENT (IMPORTANT FIX) ================= */
  if (businessSignals && /(help|need|want|looking for|fix|improve)/i.test(msg)) {
    return {
      type: "mixed_intent",
      highIntent: true,
      confidence: 0.8,
      businessContext: true,
    };
  }

  /* ================= QUESTION / EXPLORATION ================= */
  if (/\?$/.test(msg) || /(how|why|what|can you|should i|is it)/i.test(msg)) {
    return {
      type: "exploration",
      highIntent: false,
      confidence: 0.7,
      businessContext: businessSignals,
    };
  }

  /* ================= DEFAULT (SMART FALLBACK) ================= */
  return {
    type: "general",
    highIntent: businessSignals, // 🔥 IMPORTANT FIX: business users = semi-intent
    confidence: 0.5,
    businessContext: businessSignals,
  };
}
