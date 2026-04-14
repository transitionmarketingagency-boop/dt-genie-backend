import { memoryService } from "./services/memoryService.js";
import { detectMultipleServices } from "./services/serviceDetector.js";
import { shouldTriggerBooking } from "./services/bookingTrigger.js";
import { generateExecutionPlan } from "./services/executionPlanner.js";

/* ================= TYPES ================= */
type Stage =
  | "greeting"
  | "discovery"
  | "strategy"
  | "service"
  | "conversion";

type BookingState = {
  step: number;
  serviceTypes?: string[];
  preferredTime?: string;
  email?: string;
  calendlyLink?: string;
  createdAt: number;
  leadScore?: number;
  dealProbability?: number;
  triggerBooking?: boolean;
  stage?: Stage;
  executionPlan?: string;
};

interface BookingResponse {
  response: string;
  nextStep?: number;
  frontendScript?: string;
  calendlyLink?: string;
}

/* ================= STORAGE ================= */
const ongoingBookings: Record<string, BookingState> = {};
const BOOKING_SESSION_TTL = 1000 * 60 * 30; // 30 minutes

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
  if (!email || typeof email !== "string") return false;
  const cleaned = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);
}

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

/* ================= HELPERS ================= */
function normalize(text: string): string {
  return (text || "").toLowerCase().trim();
}

function isQuestion(text: string): boolean {
  return text.includes("?") || text.split(" ").length > 8;
}

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
    const message = normalize(userMessage);
    const lang = detectLanguage(message);

    /* ---------- INIT STATE SAFETY ---------- */
    if (!booking) {
      booking = { step: 1, createdAt: Date.now() };
      ongoingBookings[userId] = booking;

      const greetings = [
        "Welcome! Let's plan your digital growth. What would you like help with?",
        "Hi there! Which service are you interested in today?",
        "Let's get started! What area of your business should we focus on?",
      ];

      return {
        response: t(
          lang,
          greetings[Math.floor(Math.random() * greetings.length)],
          "خوش آمدید! آپ کس چیز میں مدد چاہتے ہیں؟"
        ),
        nextStep: 1,
      };
    }

    /* ---------- HIGH INTENT CHECK ---------- */
    let highIntent = false;

    try {
      highIntent = await shouldTriggerBooking(userId, "service", 0.6, message);
    } catch {
      highIntent = false;
    }

    switch (booking.step) {
      /* ================= STEP 1 ================= */
      case 1: {
        booking.step = 2;

        let detectedServices: string[] = [];

        try {
          detectedServices = await detectMultipleServices(message);
        } catch {
          detectedServices = [];
        }

        if (!detectedServices.length) {
          detectedServices = fallbackServiceDetection(message);
        }

        booking.serviceTypes = detectedServices;

        let plan = "";

        try {
          plan = await generateExecutionPlan(detectedServices);
        } catch {
          plan = "Standard action plan recommended.";
        }

        booking.executionPlan = plan;

        return {
          response: t(
            lang,
            `I suggest focusing on:
- ${detectedServices.join("\n- ")}

Execution plan:
${plan}

When would you like to schedule?`,
            `میں تجویز کرتا ہوں:
- ${detectedServices.join("\n- ")}

عملدرآمد کا منصوبہ:
${plan}

آپ کب وقت لینا چاہتے ہیں؟`
          ),
          nextStep: 3,
        };
      }

      /* ================= STEP 3 ================= */
      case 3: {
        if (isQuestion(message) && !highIntent) {
          return {
            response: t(
              lang,
              "We can pause booking for a moment. Let me answer your question first.",
              "ہم پہلے آپ کا سوال دیکھ لیتے ہیں۔"
            ),
          };
        }

        booking.preferredTime = message;
        booking.step = 4;

        return {
          response: t(
            lang,
            "Please provide your email to confirm booking.",
            "براہ کرم اپنا ای میل درج کریں۔"
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

        try {
          await memoryService.storeBooking({
            userId,
            serviceTypes: booking.serviceTypes,
            preferredTime: booking.preferredTime,
            email: booking.email,
            calendlyLink: booking.calendlyLink,
            executionPlan: booking.executionPlan,
            status: "pending",
          } as any);
        } catch (err) {
          console.error("Memory store failed:", err);
        }

        booking.step = 5;

        return {
          response: t(
            lang,
            `Booking ready:
${booking.calendlyLink}`,
            `آپ کی بکنگ تیار ہے:
${booking.calendlyLink}`
          ),
          nextStep: 5,
          calendlyLink: booking.calendlyLink,
        };
      }

      /* ================= STEP 5 ================= */
      case 5: {
        if (message.includes("i booked")) {
          try {
            await memoryService.updateBookingStatus(userId, "confirmed");
          } catch {
            // silent fail
          }

          delete ongoingBookings[userId];

          return {
            response: t(
              lang,
              "Booking confirmed. Details sent to your email.",
              "بکنگ کنفرم ہو گئی ہے۔"
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

      /* ================= DEFAULT ================= */
      default: {
        delete ongoingBookings[userId];

        return {
          response: t(
            lang,
            "Something went wrong. Type 'book a call' to restart.",
            "کچھ غلط ہو گیا۔ دوبارہ شروع کریں۔"
          ),
        };
      }
    }
  },

  isBookingActive: (userId: string): boolean => {
    cleanupExpiredBookings();
    return Boolean(ongoingBookings[userId]);
  },
};

export default bookingFlow;
