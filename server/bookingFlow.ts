import { detectMultipleServices } from "./services/serviceDetector.js";
import { shouldTriggerBooking } from "./services/bookingTrigger.js";

/* ================= STORAGE ================= */

const ongoingBookings: Record<string, any> = {};
const BOOKING_SESSION_TTL = 1000 * 60 * 30;

/* ================= CLEANUP ================= */

function cleanupExpiredBookings(): void {
  const now = Date.now();

  for (const userId in ongoingBookings) {
    const booking = ongoingBookings[userId];

    if (!booking || now - booking.createdAt > BOOKING_SESSION_TTL) {
      delete ongoingBookings[userId];
    }
  }
}

/* ================= NORMALIZE ================= */

function normalize(text: string): string {
  return (text || "").toLowerCase().trim();
}

/* ================= FALLBACK ================= */

function fallbackServiceDetection(message: string): string[] {
  const msg = normalize(message);
  const services: string[] = [];

  if (msg.includes("seo")) services.push("SEO Optimization");
  if (msg.includes("ads")) services.push("Performance Marketing");
  if (msg.includes("automation") || msg.includes("ai"))
    services.push("AI Marketing Automation");
  if (msg.includes("content")) services.push("Content Marketing");
  if (msg.includes("brand")) services.push("Brand Development");
  if (msg.includes("ecommerce")) services.push("Ecommerce Growth Systems");

  if (!services.length) services.push("Strategy Session");

  return services;
}

/* ================= INTENT GUARDS ================= */

function isExplicitBookingIntent(msg: string): boolean {
  return /(book\s+(a\s+)?call|schedule\s+(a\s+)?call|book\s+(a\s+)?meeting|schedule\s+(a\s+)?meeting|get\s+on\s+a\s+call|talk\s+to\s+(someone|team)|i want to (book|schedule)|let'?s schedule|can we schedule)/i.test(
    msg
  );
}

function isInformational(msg: string): boolean {
  return /(how|what|why|explain|tell me|guide|learn)/i.test(msg);
}

function isRejection(msg: string): boolean {
  return /(not now|later|just exploring|no thanks|dont want|don't want|stop|maybe later)/i.test(
    msg
  );
}

/* ================= CORE ENGINE ================= */

const bookingFlow = {
  trigger: async (
    userId: string,
    userMessage: string,
    leadScore: number = 0
  ): Promise<{
    shouldOpenUI: boolean;
    detectedServices?: string[];
  }> => {
    cleanupExpiredBookings();

    const message = normalize(userMessage);

    if (!userId || message.length < 3) {
      return { shouldOpenUI: false };
    }

    /* ---------- HARD REJECTION ---------- */
    if (isRejection(message)) {
      return { shouldOpenUI: false };
    }

    /* ---------- SERVICE DETECTION ---------- */
    let detectedServices: string[] = [];

    try {
      detectedServices = await detectMultipleServices(message);
    } catch {
      detectedServices = fallbackServiceDetection(message);
    }

    /* ---------- AI DECISION (SOURCE OF TRUTH) ---------- */
    let aiDecision = false;

    try {
      aiDecision = await shouldTriggerBooking(
        userId,
        "service",
        leadScore,
        message
      );
    } catch {
      aiDecision = false;
    }

    /* ---------- EXPLICIT INTENT (CONTROLLED OVERRIDE) ---------- */
    const explicitIntent = isExplicitBookingIntent(message);

    /* ---------- FINAL DECISION ---------- */
    const shouldOpenUI =
      aiDecision ||
      (explicitIntent && !isInformational(message) && leadScore >= 0.85);

    /* ---------- STORE SESSION ---------- */
    if (shouldOpenUI) {
      ongoingBookings[userId] = {
        createdAt: Date.now(),
        serviceTypes: detectedServices,
      };
    }

    return {
      shouldOpenUI,
      detectedServices,
    };
  },

  confirmBooking: async (userId: string): Promise<void> => {
    delete ongoingBookings[userId];
  },

  reset: (userId: string): void => {
    delete ongoingBookings[userId];
  },

  isActive: (userId: string): boolean => {
    cleanupExpiredBookings();
    return Boolean(ongoingBookings[userId]);
  },
};

export default bookingFlow;
