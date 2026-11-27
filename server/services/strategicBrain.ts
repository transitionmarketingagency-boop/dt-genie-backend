import { memoryService } from "./memoryService.js";
import { leadQualifier } from "./leadQualifier.js";
import { neuralBrain } from "./neuralBrain.js";

/* ================= TYPES ================= */

export type StrategicMemory = {
  servicesDiscussed?: string[];
  industry?: string;
  businessType?: string;
  lastInteraction?: number;

  leadScore?: number;
  stage?: string;
  intentType?: string;
};

export type ExecutionMode = "execution" | "exploration";

export type BrainContext = {
  message: string;
  stage: "greeting" | "discovery" | "strategy" | "service" | "conversion";
  leadScore: number;
  detectedServices?: string[];
  executionMode: ExecutionMode;
  hasSufficientContext?: boolean;
  intentType?: string;
  highIntent?: boolean;

  shouldAskQuestion?: boolean;
  shouldGiveCTA?: boolean;
  confidenceLevel?: number;
  strategicMemory?: StrategicMemory;
};

/* ================= HELPERS ================= */

function normalize(text: string) {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function isShortMessage(message: string) {
  return message.length < 8;
}

function isGreeting(message: string) {
  return /^(hi|hello|hey|yo)$/i.test(message);
}

/* ================= CONTEXT SHIFT (FIXED & STABILIZED) ================= */

function detectContextShift(
  message: string,
  memory: StrategicMemory
): boolean {
  const msg = normalize(message);

  // Reset only when the user clearly asks to switch/reset the business context.
  // Ordinary statements such as "I run...", "we are..." and "my business..." are context.
  const explicitSwitchSignals = [
    "switch to a different business",
    "let's discuss a different business",
    "lets discuss a different business",
    "this is a new business",
    "for a new business",
    "start a new business context",
    "forget the previous business",
    "reset business context",
    "change the business we are discussing",
    "different company now",
  ];

  return explicitSwitchSignals.some((signal) => msg.includes(signal));
}

/* ================= INDUSTRY CONTEXT DETECTION ================= */

// Detect a user's own business only when the message contains an ownership/operator
// signal. Mentioning an industry hypothetically must not overwrite their profile.
export function detectBusinessProfile(message: string): { industry: string; businessType: string; servicesDiscussed: string[] } | null {
  const msg = normalize(message);
  const ownershipSignal =
    /\b(i own|i run|i operate|i manage|i founded|i have|i work at|i work for|our company|our business|our store|our clinic|our practice|we operate|we run|we own|we manage|my company|my business|my store|my clinic|my practice|my dental|my travel|my property|my ecommerce|i am|i'm|we are|we're)\b/.test(msg);

  if (!ownershipSignal) return null;

  const industries: Array<{ industry: string; businessType: string; pattern: RegExp }> = [
    { industry: "premium_travel_experiences", businessType: "Travel and experiences", pattern: /\b(travel agent|travel agency|travel company|travel business|tour operator|tour company|tourism|guided tours|private tours|travel experiences|destination management|destination management company|dmc)\b/ },
    { industry: "real_estate", businessType: "Real estate", pattern: /\b(real estate|realtor|property developer|property agency|estate agency|realty|property brokerage|real estate brokerage)\b/ },
    { industry: "ecommerce", businessType: "E-commerce", pattern: /\b(e ?commerce|online store|online shop|direct to consumer|dtc brand|shopify store)\b/ },
    { industry: "dental_healthcare", businessType: "Dental and oral healthcare", pattern: /\b(dentist|dental clinic|dental practice|orthodontist|orthodontic clinic|oral surgery)\b/ },
    { industry: "home_services", businessType: "Home services", pattern: /\b(home services|plumbing|plumber|hvac|roofing|roofer|electrician|pest control|house cleaning|cleaning company|cleaning business|landscaping|landscaper|home renovation|renovation company|general contractor)\b/ },
    { industry: "hospitality", businessType: "Hospitality", pattern: /\b(hotel|resort|restaurant|cafe|catering|hospitality|guesthouse|short term rental)\b/ },
    { industry: "healthcare", businessType: "Healthcare", pattern: /\b(healthcare|medical clinic|medical practice|doctor|physician|physiotherapy|physiotherapist|health centre|health center)\b/ },
    { industry: "saas_software", businessType: "Software and SaaS", pattern: /\b(saas|software company|software business|software as a service|app company|tech startup)\b/ },
    { industry: "professional_services", businessType: "Professional services", pattern: /\b(law firm|lawyer|accounting firm|accountant|consultancy|consulting firm|professional services|recruitment agency|staffing agency)\b/ },
    { industry: "education", businessType: "Education", pattern: /\b(school|college|university|training institute|education business|online course|coaching institute|tutoring)\b/ },
    { industry: "fitness_wellness", businessType: "Fitness and wellness", pattern: /\b(gym|fitness studio|personal training|wellness studio|yoga studio|pilates)\b/ },
    { industry: "automotive", businessType: "Automotive", pattern: /\b(car dealership|auto dealer|automotive|auto repair|car service centre|car service center)\b/ },
    { industry: "construction", businessType: "Construction and building", pattern: /\b(construction company|construction business|construction firm|builder|building contractor|civil engineering)\b/ },
    { industry: "manufacturing", businessType: "Manufacturing", pattern: /\b(manufacturer|manufacturing|factory|industrial production)\b/ },
    { industry: "retail", businessType: "Retail", pattern: /\b(retail store|retail business|physical shop|brick and mortar)\b/ },
    { industry: "financial_services", businessType: "Financial services", pattern: /\b(financial services|insurance agency|insurance broker|financial advisory|wealth management)\b/ },
    { industry: "other", businessType: "Other / not yet classified", pattern: /\b(company|business|agency|brand|firm|startup|practice|store|shop)\b/ },
  ];

  for (const item of industries) {
    if (item.pattern.test(msg)) {
      const servicePatterns: Array<{ label: string; pattern: RegExp }> = [
        { label: "plumbing", pattern: /\b(plumbing|plumber|plumbers)\b/ },
        { label: "home cleaning", pattern: /\b(home cleaning|house cleaning|residential cleaning|cleaning company|cleaning business)\b/ },
        { label: "HVAC", pattern: /\b(hvac|heating and cooling|air conditioning)\b/ },
        { label: "roofing", pattern: /\b(roofing|roofer|roof repair)\b/ },
        { label: "electrical services", pattern: /\b(electrician|electrical services|electrical contractor)\b/ },
        { label: "pest control", pattern: /\b(pest control|exterminator)\b/ },
        { label: "landscaping", pattern: /\b(landscaping|landscaper|lawn care)\b/ },
        { label: "renovation", pattern: /\b(home renovation|renovation company|remodeling|remodelling)\b/ },
        { label: "private tours", pattern: /\b(private tours|guided tours|travel experiences)\b/ },
        { label: "property sales", pattern: /\b(property sales|residential sales|real estate sales)\b/ },
        { label: "skincare", pattern: /\b(skincare|skin care)\b/ },
      ];
      const servicesDiscussed = servicePatterns
        .filter((service) => service.pattern.test(msg))
        .map((service) => service.label);
      return { industry: item.industry, businessType: item.businessType, servicesDiscussed };
    }
  }

  return null;
}

/* ================= STAGE DETECTOR ================= */

function detectStage(
  message: string,
  intentType?: string
): BrainContext["stage"] {
  const msg = normalize(message);

  if (intentType === "greeting") return "greeting";
  if (intentType === "booking") return "conversion";
  if (intentType === "service_inquiry") return "service";
  if (intentType === "problem") return "strategy";

  if (/(hire|book|start|work with you|get started)/i.test(msg))
    return "conversion";

  if (/(price|cost|service|offer)/i.test(msg)) return "service";

  if (/(how|fix|improve|scale|grow|increase)/i.test(msg))
    return "strategy";

  return "discovery";
}

/* ================= EXECUTION LOGIC (STABILIZED) ================= */

function computeExecutionSignals(params: {
  stage: BrainContext["stage"];
  leadScore: number;
  highIntent: boolean;
  message: string;
}) {
  const { stage, leadScore, highIntent, message } = params;

  const shortMsg = isShortMessage(message);

  // ❌ FIX: prevent unstable execution mode flips from neuralBrain noise
  const safeHighIntent = highIntent && message.length > 10;

  const executionMode: ExecutionMode =
    safeHighIntent && !shortMsg
      ? "execution"
      : leadScore >= 0.75 && stage !== "greeting"
      ? "execution"
      : "exploration";

  const shouldGiveCTA =
    !shortMsg &&
    (safeHighIntent ||
      (leadScore >= 0.78 && stage !== "discovery") ||
      stage === "conversion");

  const shouldAskQuestion =
    !shortMsg &&
    stage === "discovery" &&
    leadScore < 0.6 &&
    !safeHighIntent;

  const confidenceLevel = Math.min(
    1,
    leadScore * 0.75 + (safeHighIntent ? 0.25 : 0)
  );

  return {
    executionMode,
    shouldGiveCTA,
    shouldAskQuestion,
    confidenceLevel,
  };
}

/* ================= MAIN ================= */

export async function strategicBrain(
  userMessage: string,
  sessionId?: string
): Promise<{ brainContext: BrainContext; chunks: [] }> {
  const message = normalize(userMessage);

  let strategicMemory: StrategicMemory = {};

  if (sessionId) {
    try {
      strategicMemory =
        (await memoryService.getStrategicMemory(sessionId)) || {};
    } catch {
      strategicMemory = {};
    }
  }

  /* ---------- CONTEXT SHIFT + INDUSTRY PROFILE ---------- */
  const contextWasExplicitlyReset = detectContextShift(message, strategicMemory);
  if (contextWasExplicitlyReset) {
    strategicMemory = {
      servicesDiscussed: [],
      industry: undefined,
      businessType: undefined,
      leadScore: 0,
      stage: "discovery",
    };
    if (sessionId) {
      await memoryService.updateStrategicMemory(sessionId, {
        industry: "",
        businessType: "",
        servicesDiscussed: [],
        goals: [],
        lastDetectedServices: [],
        lastUserProblem: "",
      }).catch(() => {});
    }
  }

  const detectedBusiness = detectBusinessProfile(userMessage);
  if (detectedBusiness && sessionId) {
    strategicMemory = { ...strategicMemory, ...detectedBusiness };
    await memoryService.updateStrategicMemory(sessionId, detectedBusiness).catch(() => {});
  }

  /* ---------- INTENT (STABILIZED) ---------- */
  let intent: any = {};

  try {
    const rawIntent = neuralBrain?.(message) || {};

    // ❌ FIX: sanitize unstable neural outputs
    intent = {
      type: typeof rawIntent?.type === "string" ? rawIntent.type : "general",
      highIntent: Boolean(rawIntent?.highIntent),
    };
  } catch {
    intent = { type: "general", highIntent: false };
  }

  const intentType = intent.type;
  const highIntent = Boolean(intent.highIntent);

  /* ---------- LEAD SCORE (STABILIZED) ---------- */
  let leadScore = 0;

  try {
    const scoreResult = leadQualifier?.scoreLead?.(
      sessionId || "anon",
      {
        need: intentType === "problem" ? 0.6 : 0.3,
        authority: highIntent ? 0.8 : 0.3,
      }
    );

    leadScore = Number(scoreResult?.total ?? 0);

    // ❌ FIX: clamp invalid values
    if (isNaN(leadScore) || leadScore < 0) leadScore = 0;
    if (leadScore > 1) leadScore = 1;
  } catch {
    leadScore = 0;
  }

  /* ---------- STAGE ---------- */
  const stage = isGreeting(message)
    ? "greeting"
    : detectStage(message, intentType);

  /* ---------- SIGNALS ---------- */
  const signals = computeExecutionSignals({
    stage,
    leadScore,
    highIntent,
    message,
  });

  /* ---------- CONTEXT QUALITY ---------- */
  const hasSufficientContext =
    message.length > 12 || highIntent || intentType === "problem";

  return {
    brainContext: {
      message: userMessage,
      stage,
      leadScore,
      detectedServices: strategicMemory?.servicesDiscussed || [],
      executionMode: signals.executionMode,
      hasSufficientContext,
      intentType,
      highIntent,
      shouldAskQuestion: signals.shouldAskQuestion,
      shouldGiveCTA: signals.shouldGiveCTA,
      confidenceLevel: signals.confidenceLevel,
      strategicMemory,
    },
    chunks: [],
  };
}
