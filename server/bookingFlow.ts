// server/bookingFlow.ts

import { memoryService } from "./services/memoryService.js";

/* ================= TYPES ================= */

type BookingState = {
  step: number;
  serviceType?: string;
  preferredTime?: string;
  email?: string;
  calendlyLink?: string;
  createdAt: number;
};

interface BookingResponse {
  response: string;
  nextStep?: number;
  frontendScript?: string;
}

/* ================= BOOKING STATE STORAGE ================= */

const ongoingBookings: Record<string, BookingState> = {};
const BOOKING_SESSION_TTL = 1000 * 60 * 30; // 30 minutes

/* ================= CALENDLY LINK ================= */

const baseCalendlyLink =
  "https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future";

/* ================= EMAIL VALIDATION ================= */

function isValidEmail(email: string): boolean {
  const cleaned = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);
}

/* ================= CLEANUP EXPIRED BOOKINGS ================= */

function cleanupExpiredBookings() {
  const now = Date.now();
  for (const userId in ongoingBookings) {
    const booking = ongoingBookings[userId];
    if (now - booking.createdAt > BOOKING_SESSION_TTL) {
      delete ongoingBookings[userId];
    }
  }
}

/* ================= BOOKING FLOW ================= */

const bookingFlow = {
  startBookingFlow: async (userId: string, userMessage: string): Promise<BookingResponse> => {
    cleanupExpiredBookings();
    if (!ongoingBookings[userId]) {
      ongoingBookings[userId] = { step: 1, createdAt: Date.now() };
    }
    return bookingFlow.handleStep(userId, userMessage);
  },

  handleStep: async (userId: string, userMessage: string): Promise<BookingResponse> => {
    cleanupExpiredBookings();
    const booking = ongoingBookings[userId];
    const message = (userMessage || "").trim();

    if (!booking) {
      ongoingBookings[userId] = { step: 1, createdAt: Date.now() };
      return {
        response: "Let's start your booking again. Which service are you interested in?",
        nextStep: 1,
      };
    }

    switch (booking.step) {

      case 1:
        booking.step = 2;
        return {
          response: `I can help you schedule your strategy session.\n\nWhich service are you interested in?\n\n• AI Marketing\n• CGI Property Tours\n• SEO / GEO\n• General Consultation`,
          nextStep: 2,
        };

      case 2:
        booking.serviceType = message;
        booking.step = 3;
        return {
          response: "Great choice. When would you like to schedule your session? Please share your preferred **date and time**.",
          nextStep: 3,
        };

      case 3:
        booking.preferredTime = message;
        booking.step = 4;
        return {
          response: "Perfect. Please provide your **email address** so we can confirm your booking.",
          nextStep: 4,
        };

      case 4:
        if (!isValidEmail(message)) {
          return { response: "Please enter a **valid email address** to continue.", nextStep: 4 };
        }

        booking.email = message.trim().toLowerCase();
        booking.calendlyLink = baseCalendlyLink; // Generic link, no email embedded

        try {
          await memoryService.storeBooking({
            userId,
            serviceType: booking.serviceType,
            preferredTime: booking.preferredTime,
            email: booking.email,
            calendlyLink: booking.calendlyLink,
            status: "pending",
          });
        } catch (err) {
          console.error("⚠️ Failed storing booking:", err);
        }

        const frontendTriggerScript = `
(function(){
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
          response: `Awesome! Your booking info is ready for **${booking.serviceType}**.\n\nYou can now book a call using the safe booking link below (CLI hides email for privacy):\n\n${booking.calendlyLink}\n\nAfter completing the booking, type **"I booked"** to confirm your session.`,
          nextStep: 5,
          frontendScript: frontendTriggerScript,
        };

      case 5:
        if (message.toLowerCase().includes("i booked")) {
          try {
            await memoryService.updateBookingStatus(userId, "confirmed");
          } catch (err) {
            console.error("⚠️ Failed updating booking status:", err);
          }
          delete ongoingBookings[userId];
          return { response: "Perfect! Your strategy session is confirmed. You'll receive the meeting details shortly via email." };
        }
        return { response: "Once you complete the booking, type **'I booked'** to confirm your session." };

      default:
        delete ongoingBookings[userId];
        return { response: "Something went wrong with the booking flow. Please type **'book a call'** to start again." };
    }
  },

  isBookingActive: (userId: string): boolean => {
    cleanupExpiredBookings();
    return Boolean(ongoingBookings[userId]);
  },
};

export default bookingFlow;
