// server/bookingFlow.ts

import { memoryService } from "./services/memoryService.js";
import { shouldTriggerBooking } from "./services/bookingTrigger.js";

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

/* ================= BOOKING FLOW ================= */

const bookingFlow = {

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
        response:
          "Let's restart your booking. Which service are you interested in?",
        nextStep: 1,
      };
    }

    switch (booking.step) {

      case 1:
        booking.step = 2;

        return {
          response:
            `I’ll help you schedule your strategy session.\n\n` +
            `Which service are you interested in?\n\n` +
            `• AI Marketing\n• CGI Property Tours\n• SEO / GEO\n• General Consultation`,
          nextStep: 2,
        };

      case 2:
        booking.serviceType = message || "General Consultation";
        booking.step = 3;

        return {
          response:
            "Great choice. When would you like to schedule your session? Please share your preferred **date and time**.",
          nextStep: 3,
        };

      case 3:
        booking.preferredTime = message;
        booking.step = 4;

        return {
          response:
            "Perfect. Please provide your **email address** so we can confirm your booking.",
          nextStep: 4,
        };

      case 4:
        if (!isValidEmail(message)) {
          return {
            response: "Please enter a **valid email address** to continue.",
            nextStep: 4,
          };
        }

        booking.email = message.toLowerCase();
        booking.calendlyLink = baseCalendlyLink;

        /* ===== STORE BOOKING (FIXED) ===== */

        try {
          await memoryService.storeBooking({
            userId,
            serviceType: booking.serviceType,
            preferredTime: booking.preferredTime,
            email: booking.email,
            calendlyLink: booking.calendlyLink,
            status: "pending",

            // 🔥 SAFE EXTENSION (NO TS ERROR)
            ...(booking.leadScore !== undefined && { leadScore: booking.leadScore }),
            ...(booking.dealProbability !== undefined && { dealProbability: booking.dealProbability }),
            ...(booking.triggerBooking !== undefined && { triggerBooking: booking.triggerBooking }),

          } as any); // ✅ KEY FIX
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

      case 5:
        if (message.toLowerCase().includes("i booked")) {

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

      default:
        delete ongoingBookings[userId];

        return {
          response:
            "Something broke in booking flow. Type **'book a call'** to restart.",
        };
    }
  },

  isBookingActive: (userId: string): boolean => {
    cleanupExpiredBookings();
    return Boolean(ongoingBookings[userId]);
  },
};

export default bookingFlow;
