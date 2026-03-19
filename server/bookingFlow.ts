// server/bookingFlow.ts

import { memoryService } from "./services/memoryService.js";
import { detectService } from "./services/serviceDetector.js";

/* ================= TYPES ================= */

type Stage = "greeting" | "discovery" | "strategy" | "service" | "conversion";

type BookingState = {
  step: number;
  serviceType?: string;
  preferredTime?: string;
  email?: string;
  calendlyLink?: string;
  createdAt: number;
  leadScore?: number;
  dealProbability?: number;
  triggerBooking?: boolean;
  stage?: Stage;
};

interface BookingResponse {
  response: string;
  nextStep?: number;
  frontendScript?: string;
}

/* ================= STORAGE ================= */

const ongoingBookings: Record<string, BookingState> = {};
const BOOKING_SESSION_TTL = 1000 * 60 * 30;

const baseCalendlyLink =
  "https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future";

/* ================= VALIDATION ================= */

function isValidEmail(email: string): boolean {
  const cleaned = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);
}

/* ================= CLEANUP ================= */

function cleanupExpiredBookings() {
  const now = Date.now();

  for (const userId in ongoingBookings) {
    const booking = ongoingBookings[userId];

    if (!booking || now - booking.createdAt > BOOKING_SESSION_TTL) {
      delete ongoingBookings[userId];
    }
  }
}

/* ================= SAFE TYPE GUARDS ================= */

// ✅ Fix TS error: ensure valid stage
function isValidStage(stage: any): stage is Stage {
  return ["greeting", "discovery", "strategy", "service", "conversion"].includes(stage);
}

/* ================= SMART HELPERS ================= */

function normalize(text: string) {
  return (text || "").toLowerCase().trim();
}

function fallbackServiceDetection(message: string): string | null {
  const msg = normalize(message);

  if (msg.includes("seo")) return "SEO Optimization";
  if (msg.includes("ads") || msg.includes("advertising")) return "Performance Marketing";
  if (msg.includes("automation") || msg.includes("ai")) return "AI Marketing Automation";
  if (msg.includes("content")) return "Content Marketing";
  if (msg.includes("brand")) return "Brand Development";
  if (msg.includes("ecommerce")) return "Ecommerce Growth Systems";

  return null;
}

/* ================= BOOKING FLOW ================= */

const bookingFlow = {

  /* ================= START ================= */

  startBookingFlow: async (
    userId: string,
    userMessage: string
  ): Promise<BookingResponse> => {
    cleanupExpiredBookings();

    if (!ongoingBookings[userId]) {
      ongoingBookings[userId] = {
        step: 1,
        createdAt: Date.now(),
      };
    }

    return bookingFlow.handleStep(userId, userMessage);
  },

  forceStart: async (
    userId: string,
    userMessage: string
  ): Promise<BookingResponse> => {
    ongoingBookings[userId] = {
      step: 1,
      createdAt: Date.now(),
    };

    return bookingFlow.handleStep(userId, userMessage);
  },

  reset: (userId: string) => {
    delete ongoingBookings[userId];
  },

  /* ================= CORE FLOW ================= */

  handleStep: async (
    userId: string,
    userMessage: string
  ): Promise<BookingResponse> => {
    cleanupExpiredBookings();

    let booking = ongoingBookings[userId];
    const message = (userMessage || "").trim();

    if (!booking) {
      booking = {
        step: 1,
        createdAt: Date.now(),
      };

      ongoingBookings[userId] = booking;

      return {
        response: "Let’s restart your booking. What would you like help with?",
        nextStep: 1,
      };
    }

    switch (booking.step) {

      /* ================= STEP 1 ================= */

      case 1: {
        booking.step = 2;

        let detectedService: string | null = null;

        try {
          detectedService = detectService(message);
        } catch {}

        if (!detectedService) {
          detectedService = fallbackServiceDetection(message);
        }

        if (detectedService) {
          booking.serviceType = detectedService;

          return {
            response: `Great — we’ll focus on **${detectedService}**.\n\nWhen would you like to schedule your session?`,
            nextStep: 3,
          };
        }

        return {
          response:
            `I’ll help you schedule your strategy session.\n\n` +
            `What would you like to focus on? (e.g. lead generation, SEO, automation, ads)`,
          nextStep: 2,
        };
      }

      /* ================= STEP 2 ================= */

      case 2: {
        booking.serviceType = message || "General Consultation";
        booking.step = 3;

        return {
          response:
            `Got it — we’ll focus on **${booking.serviceType}**.\n\n` +
            `When would you like to schedule your session? Please share your preferred **date and time**.`,
          nextStep: 3,
        };
      }

      /* ================= STEP 3 ================= */

      case 3: {
        booking.preferredTime = message;
        booking.step = 4;

        return {
          response:
            "Perfect. Please provide your **email address** so we can confirm your booking.",
          nextStep: 4,
        };
      }

      /* ================= STEP 4 (FIXED) ================= */

      case 4: {
        if (!isValidEmail(message)) {
          return {
            response: "Please enter a **valid email address** to continue.",
            nextStep: 4,
          };
        }

        booking.email = message.toLowerCase();
        booking.calendlyLink = baseCalendlyLink;

        // ✅ SAFE strategic memory mapping (FIXED)
        try {
          const strategicMemory: any = await memoryService.getStrategicMemory(userId);

          if (strategicMemory) {
            if (typeof strategicMemory.leadScore === "number") {
              booking.leadScore = strategicMemory.leadScore;
            }

            if (typeof strategicMemory.dealProbability === "number") {
              booking.dealProbability = strategicMemory.dealProbability;
            }

            if (typeof strategicMemory.triggerBooking === "boolean") {
              booking.triggerBooking = strategicMemory.triggerBooking;
            }

            if (isValidStage(strategicMemory.stage)) {
              booking.stage = strategicMemory.stage;
            }
          }
        } catch {}

        try {
          await memoryService.storeBooking({
            userId,
            serviceType: booking.serviceType,
            preferredTime: booking.preferredTime,
            email: booking.email,
            calendlyLink: booking.calendlyLink,
            status: "pending",

            ...(booking.leadScore !== undefined && { leadScore: booking.leadScore }),
            ...(booking.dealProbability !== undefined && { dealProbability: booking.dealProbability }),
            ...(booking.triggerBooking !== undefined && { triggerBooking: booking.triggerBooking }),

          } as any);
        } catch (err) {
          console.error("⚠️ Failed storing booking:", err);
        }

        const frontendScript = `(function(){
  try {
    if (window.openCalendlyPopup) {
      window.openCalendlyPopup("${booking.calendlyLink}");
      return;
    }
    if (window.Calendly && window.Calendly.initPopupWidget) {
      window.Calendly.initPopupWidget({ url: "${booking.calendlyLink}" });
      return;
    }
    window.open("${booking.calendlyLink}", "_blank");
  } catch(e) {
    window.open("${booking.calendlyLink}", "_blank");
  }
})();`;

        booking.step = 5;

        return {
          response:
            `Awesome! Your booking for **${booking.serviceType}** is ready.\n\n` +
            `Use the link below to confirm your session:\n\n${booking.calendlyLink}\n\n` +
            `After booking, type **"I booked"** to confirm.`,
          nextStep: 5,
          frontendScript,
        };
      }

      /* ================= STEP 5 ================= */

      case 5: {
        if (normalize(message).includes("i booked")) {

          try {
            await memoryService.updateBookingStatus(userId, "confirmed");
          } catch (err) {
            console.error("⚠️ Failed updating booking status:", err);
          }

          delete ongoingBookings[userId];

          return {
            response:
              "Perfect! Your strategy session is confirmed. You’ll receive details via email shortly.",
          };
        }

        return {
          response:
            "Once you complete the booking, type **'I booked'** to confirm your session.",
        };
      }

      /* ================= FALLBACK ================= */

      default:
        delete ongoingBookings[userId];

        return {
          response:
            "Something broke in booking flow. Type **'book a call'** to restart.",
        };
    }
  },

  /* ================= STATE CHECK ================= */

  isBookingActive: (userId: string): boolean => {
    cleanupExpiredBookings();
    return Boolean(ongoingBookings[userId]);
  },
};

export default bookingFlow;
