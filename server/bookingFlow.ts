import { memoryService } from "./services/memoryService.js";

type BookingState = {
  step: number;
  serviceType?: string;
  preferredTime?: string;
  email?: string;
  calendlyLink?: string;
};

interface BookingResponse {
  response: string;
  nextStep?: number;
  frontendScript?: string;
}

/* ================= BOOKING STATE STORAGE ================= */
const ongoingBookings: Record<string, BookingState> = {};

/* ================= CALENDLY LINK ================= */
const baseCalendlyLink =
  "https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future";

/* ================= EMAIL VALIDATION ================= */
function isValidEmail(email: string): boolean {
  return /\S+@\S+\.\S+/.test(email);
}

/* ================= BOOKING FLOW ================= */
const bookingFlow = {
  startBookingFlow: async (
    userId: string,
    userMessage: string
  ): Promise<BookingResponse> => {
    if (!ongoingBookings[userId]) {
      ongoingBookings[userId] = { step: 1 };
    }

    return bookingFlow.handleStep(userId, userMessage);
  },

  handleStep: async (
    userId: string,
    userMessage: string
  ): Promise<BookingResponse> => {
    const booking = ongoingBookings[userId];

    if (!booking) {
      ongoingBookings[userId] = { step: 1 };
      return {
        response:
          "Let's start your booking again. Which service are you interested in?",
        nextStep: 1,
      };
    }

    const message = userMessage.trim();

    switch (booking.step) {
      /* ================= STEP 1 ================= */
      case 1:
        booking.step = 2;
        return {
          response: `I can help you schedule your strategy session.

Which service are you interested in?

• AI Marketing  
• CGI Property Tours  
• SEO / GEO  
• General Consultation`,
          nextStep: 2,
        };

      /* ================= STEP 2 ================= */
      case 2:
        booking.serviceType = message;
        booking.step = 3;
        return {
          response:
            "Great choice. When would you like to schedule your session? Please share your preferred **date and time**.",
          nextStep: 3,
        };

      /* ================= STEP 3 ================= */
      case 3:
        booking.preferredTime = message;
        booking.step = 4;
        return {
          response:
            "Perfect. Please provide your **email address** so we can send the meeting confirmation.",
          nextStep: 4,
        };

      /* ================= STEP 4 ================= */
      case 4:
        if (!isValidEmail(message)) {
          return {
            response: "Please enter a **valid email address** so we can continue.",
            nextStep: 4,
          };
        }

        booking.email = message;
        booking.calendlyLink = `${baseCalendlyLink}?email=${encodeURIComponent(
          booking.email
        )}&name=${encodeURIComponent(userId)}`;

        /* ===== Store booking safely ===== */
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

        /* ===== Calendly popup trigger ===== */
        const frontendTriggerScript = `
if (window.openCalendlyPopup) {
  window.openCalendlyPopup();
} else {
  window.open("${booking.calendlyLink}", "_blank");
}
`;

        booking.step = 5;

        return {
          response: `Awesome! Your booking info is ready for **${booking.serviceType}**.

You can now **book a call** using the link below:

${booking.calendlyLink}

The booking form should also open automatically.

After completing the booking, type **"I booked"** so I can confirm your session.`,
          nextStep: 5,
          frontendScript: frontendTriggerScript,
        };

      /* ================= STEP 5 ================= */
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
              "✅ Perfect! Your strategy session is confirmed. You'll receive the meeting details shortly via email.",
          };
        }

        return {
          response:
            "Please type **'I booked'** once you've completed the booking through the form.",
        };

      /* ================= FAILSAFE ================= */
      default:
        delete ongoingBookings[userId];
        return {
          response:
            "Something went wrong with the booking flow. Please type **'book a call'** to start again.",
        };
    }
  },

  /* ================= BOOKING STATE CHECK ================= */
  isBookingActive: (userId: string): boolean => {
    return Boolean(ongoingBookings[userId]);
  },
};

export default bookingFlow;
