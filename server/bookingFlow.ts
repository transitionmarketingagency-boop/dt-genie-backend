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

/* ================= LANGUAGE DETECTION ================= */

function detectLanguage(text: string): "ur" | "en" {
  const urduRegex = /[\u0600-\u06FF]/;
  return urduRegex.test(text) ? "ur" : "en";
}

function t(lang: "ur" | "en", en: string, ur: string): string {
  return lang === "ur" ? ur : en;
}

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

/* ================= HELPERS ================= */

function normalize(text: string) {
  return (text || "").toLowerCase().trim();
}

function isQuestion(text: string): boolean {
  return text.includes("?") || text.split(" ").length > 8;
}

function fallbackServiceDetection(message: string): string | null {
  const msg = normalize(message);

  if (msg.includes("seo")) return "SEO Optimization";
  if (msg.includes("ads")) return "Performance Marketing";
  if (msg.includes("automation") || msg.includes("ai")) return "AI Marketing Automation";
  if (msg.includes("content")) return "Content Marketing";
  if (msg.includes("brand")) return "Brand Development";
  if (msg.includes("ecommerce")) return "Ecommerce Growth Systems";

  return null;
}

/* ================= BOOKING FLOW ================= */

const bookingFlow = {

  startBookingFlow: async (userId: string, userMessage: string): Promise<BookingResponse> => {
    cleanupExpiredBookings();

    if (!ongoingBookings[userId]) {
      ongoingBookings[userId] = {
        step: 1,
        createdAt: Date.now(),
      };
    }

    return bookingFlow.handleStep(userId, userMessage);
  },

  forceStart: async (userId: string, userMessage: string): Promise<BookingResponse> => {
    ongoingBookings[userId] = {
      step: 1,
      createdAt: Date.now(),
    };
    return bookingFlow.handleStep(userId, userMessage);
  },

  reset: (userId: string) => {
    delete ongoingBookings[userId];
  },

  handleStep: async (userId: string, userMessage: string): Promise<BookingResponse> => {
    cleanupExpiredBookings();

    let booking = ongoingBookings[userId];
    const message = (userMessage || "").trim();
    const lang = detectLanguage(message);

    if (!booking) {
      booking = { step: 1, createdAt: Date.now() };
      ongoingBookings[userId] = booking;

      return {
        response: t(
          lang,
          "Let’s restart your booking. What would you like help with?",
          "چلیں دوبارہ شروع کرتے ہیں۔ آپ کو کس چیز میں مدد چاہیے؟"
        ),
        nextStep: 1,
      };
    }

    switch (booking.step) {

      /* ================= STEP 1 ================= */

      case 1: {
        booking.step = 2;

        let detectedService = detectService(message) || fallbackServiceDetection(message);

        if (detectedService) {
          booking.serviceType = detectedService;

          return {
            response: t(
              lang,
              `Great — we’ll focus on ${detectedService}. When would you like to schedule?`,
              `بہترین — ہم ${detectedService} پر فوکس کریں گے۔ آپ کب وقت لینا چاہتے ہیں؟`
            ),
            nextStep: 3,
          };
        }

        return {
          response: t(
            lang,
            "What would you like to focus on? (SEO, ads, automation, etc.)",
            "آپ کس چیز پر فوکس کرنا چاہتے ہیں؟ (SEO، ads، automation وغیرہ)"
          ),
          nextStep: 2,
        };
      }

      /* ================= STEP 2 ================= */

      case 2: {
        const detected = detectService(message) || fallbackServiceDetection(message);

        booking.serviceType = detected || "Strategy Session";
        booking.step = 3;

        return {
          response: t(
            lang,
            `Got it — ${booking.serviceType}. When should we schedule?`,
            `ٹھیک ہے — ${booking.serviceType}۔ کب وقت رکھیں؟`
          ),
          nextStep: 3,
        };
      }

      /* ================= STEP 3 (FIXED INTERRUPTION) ================= */

      case 3: {
        // 🔥 Interrupt booking if user asks a question
        if (isQuestion(message)) {
          return {
            response: t(
              lang,
              "Got it — we can pause booking for a moment. Let me answer that first.",
              "ٹھیک ہے — ہم بکنگ کو تھوڑی دیر روک دیتے ہیں، پہلے میں آپ کا سوال جواب دیتا ہوں۔"
            ),
          };
        }

        booking.preferredTime = message;
        booking.step = 4;

        return {
          response: t(
            lang,
            "Please share your email to confirm booking.",
            "براہ کرم اپنا ای میل دیں تاکہ بکنگ کنفرم ہو سکے۔"
          ),
          nextStep: 4,
        };
      }

      /* ================= STEP 4 ================= */

      case 4: {
        if (!isValidEmail(message)) {
          return {
            response: t(
              lang,
              "Please enter a valid email.",
              "براہ کرم درست ای میل درج کریں۔"
            ),
            nextStep: 4,
          };
        }

        booking.email = message.toLowerCase();
        booking.calendlyLink = baseCalendlyLink;

        await memoryService.storeBooking({
          userId,
          serviceType: booking.serviceType,
          preferredTime: booking.preferredTime,
          email: booking.email,
          calendlyLink: booking.calendlyLink,
          status: "pending",
        } as any);

        booking.step = 5;

        return {
          response: t(
            lang,
            `Booking ready:\n${booking.calendlyLink}`,
            `آپ کی بکنگ تیار ہے:\n${booking.calendlyLink}`
          ),
          nextStep: 5,
        };
      }

      /* ================= STEP 5 ================= */

      case 5: {
        if (normalize(message).includes("i booked")) {
          await memoryService.updateBookingStatus(userId, "confirmed");
          delete ongoingBookings[userId];

          return {
            response: t(
              lang,
              "Booking confirmed. Details sent to your email.",
              "بکنگ کنفرم ہو گئی ہے۔ تفصیلات ای میل پر بھیج دی گئی ہیں۔"
            ),
          };
        }

        return {
          response: t(
            lang,
            "Complete booking and type 'I booked'.",
            "بکنگ مکمل کریں اور 'I booked' لکھیں۔"
          ),
        };
      }

      default:
        delete ongoingBookings[userId];

        return {
          response: t(
            lang,
            "Something went wrong. Type 'book a call' to restart.",
            "کچھ غلط ہو گیا۔ دوبارہ شروع کرنے کے لیے 'book a call' لکھیں۔"
          ),
        };
    }
  },

  isBookingActive: (userId: string): boolean => {
    cleanupExpiredBookings();
    return Boolean(ongoingBookings[userId]);
  },
};

export default bookingFlow;
