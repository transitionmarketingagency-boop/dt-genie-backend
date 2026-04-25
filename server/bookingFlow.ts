import { detectMultipleServices } from "./services/serviceDetector.js";
import { shouldTriggerBooking } from "./services/bookingTrigger.js";

/* ================= STORAGE ================= */

const ongoingBookings: Record<string, any> = {};
const BOOKING_SESSION_TTL = 1000 * 60 * 30;

const baseCalendlyLink =
  "https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future";

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

/* ================= CORE ENGINE ================= */

const bookingFlow = {
  /**
   * ONLY RESPONSIBILITY:
   * Decide whether booking UI should open
   */
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

    let detectedServices: string[] = [];

    try {
      detectedServices = await detectMultipleServices(message);
    } catch {
      detectedServices = fallbackServiceDetection(message);
    }

    // AI + rule hybrid decision (SINGLE SOURCE OF TRUTH)
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

    const strongIntent =
      /(book|call|schedule|meeting|appointment|get started|hire)/i.test(
        message
      );

    const shouldOpenUI = strongIntent || aiDecision;

    // store ONLY if UI opens (no flow logic)
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

  /**
   * Called from frontend after booking is completed
   */
  confirmBooking: async (userId: string): Promise<void> => {
    delete ongoingBookings[userId];
  },

  /**
   * Reset session
   */
  reset: (userId: string): void => {
    delete ongoingBookings[userId];
  },

  /**
   * UI helper only (no logic)
   */
  isActive: (userId: string): boolean => {
    cleanupExpiredBookings();
    return Boolean(ongoingBookings[userId]);
  },
};

export default bookingFlow;
