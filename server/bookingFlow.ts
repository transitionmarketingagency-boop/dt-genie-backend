/**
 * ================================
 * BOOKING FLOW (DISABLED - SAFE MODE)
 * ================================
 *
 * Keeps interface intact but disables multi-step booking.
 * Always redirects user to website booking.
 */

type BookingResponse = {
  response: string;
  calendlyLink?: string;
};

const BOOKING_MESSAGE =
  "You can book a call directly through our website — choose a time that works for you.";

const baseCalendlyLink =
  "https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future";

const bookingFlow = {
  /**
   * START BOOKING (kept for compatibility)
   */
  startBookingFlow: async (
    userId: string,
    userMessage: string
  ): Promise<BookingResponse> => {
    return {
      response: BOOKING_MESSAGE,
      calendlyLink: baseCalendlyLink,
    };
  },

  /**
   * FORCE START (kept for compatibility)
   */
  forceStart: async (
    userId: string,
    userMessage: string
  ): Promise<BookingResponse> => {
    return {
      response: BOOKING_MESSAGE,
      calendlyLink: baseCalendlyLink,
    };
  },

  /**
   * HANDLE STEP (disabled logic, still compatible)
   */
  handleStep: async (
    userId: string,
    userMessage: string
  ): Promise<BookingResponse> => {
    return {
      response: BOOKING_MESSAGE,
      calendlyLink: baseCalendlyLink,
    };
  },

  /**
   * RESET (no-op)
   */
  reset: (userId: string): void => {
    return;
  },

  /**
   * ALWAYS FALSE → disables flow completely
   */
  isBookingActive: (userId: string): boolean => {
    return false;
  },
};

export default bookingFlow;
