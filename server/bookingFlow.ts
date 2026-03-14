// bookingFlow.ts
import memoryService from "./services/memoryService";

type BookingState = {
  step: number;
  serviceType?: string;
  preferredTime?: string;
  email?: string;
  calendlyLink?: string;
};

// In-memory tracker for ongoing booking flows per user
const ongoingBookings: Record<string, BookingState> = {};

const baseCalendlyLink =
  "https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future";

export default {
  startBookingFlow: (userId: string, userMessage: string) => {
    if (!ongoingBookings[userId]) {
      ongoingBookings[userId] = { step: 1 };
    }

    return this.handleStep(userId, userMessage);
  },

  handleStep: (userId: string, userMessage: string) => {
    const booking = ongoingBookings[userId];

    switch (booking.step) {
      case 1:
        booking.step = 2;
        return {
          response: `I can help you schedule your strategy session. Which service are you interested in? (AI marketing, CGI property tours, SEO/GEO, General consultation)`,
          nextStep: 2,
        };

      case 2:
        booking.serviceType = userMessage;
        booking.step = 3;
        return {
          response: `Great! When would you like to schedule your session? Please provide your preferred date and time.`,
          nextStep: 3,
        };

      case 3:
        booking.preferredTime = userMessage;
        booking.step = 4;
        return {
          response: `Perfect. Could you share your email so we can send the confirmation?`,
          nextStep: 4,
        };

      case 4:
        booking.email = userMessage;

        // Generate dynamic Calendly link with pre-filled name/email
        booking.calendlyLink = `${baseCalendlyLink}?email=${encodeURIComponent(
          booking.email
        )}&name=${encodeURIComponent(userId)}`;

        // Store booking in memory service
        memoryService.storeBooking({
          userId,
          serviceType: booking.serviceType,
          preferredTime: booking.preferredTime,
          email: booking.email,
          calendlyLink: booking.calendlyLink,
          status: "pending",
        });

        // Trigger frontend popup via chatbot widget (frontend will execute)
        const frontendTriggerScript = `
          if (window.openCalendlyPopup) {
            window.openCalendlyPopup();
          }
        `;

        booking.step = 5; // final step
        return {
          response: `Awesome! Your booking info is set for **${booking.serviceType}**. 
Click the link to **book a call** or the form should have appeared automatically. 
[Book a Call](${booking.calendlyLink})

Once you’ve booked, type 'I booked' so I can confirm your session and next steps.`,
          nextStep: 5,
          frontendScript: frontendTriggerScript,
        };

      case 5:
        if (userMessage.toLowerCase().includes("i booked")) {
          booking.step = 6;
          memoryService.updateBookingStatus(userId, "confirmed");
          delete ongoingBookings[userId]; // flow complete
          return {
            response: `✅ Thank you for confirming! Your strategy session is booked. We’ll send you an email with all details shortly.`,
          };
        } else {
          return {
            response: `Please type 'I booked' once you've completed the booking through the form or the link.`,
          };
        }

      default:
        return {
          response: `It seems there’s an issue with the booking flow. Let’s start again. Type 'book a call' to begin.`,
        };
    }
  },
};
