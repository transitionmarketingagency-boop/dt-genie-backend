/* =====================================================
   SERVICE DETECTOR — FINAL PRODUCTION STABLE
===================================================== */

export type DetectedIntent = {
  type:
    | "service"
    | "lead"
    | "sales"
    | "pricing"
    | "consultation"
    | "marketing_goal"
    | "problem"
    | "industry"
    | "general";
  value: string;
  confidence: number;
};

/* ================= NORMALIZATION ================= */
function normalize(text: string = ""): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ================= KEYWORD MATCH ================= */
function matchKeyword(text: string, keyword: string): number {
  const normalizedText = normalize(text);
  const kw = normalize(keyword);

  if (!kw) return 0;

  const exactRegex = new RegExp(`\\b${escapeRegex(kw)}\\b`, "i");
  if (exactRegex.test(normalizedText)) return 1;

  const words = kw.split(" ").filter(Boolean);
  let hits = 0;

  for (const w of words) {
    if (normalizedText.includes(w)) hits++;
  }

  return (hits / words.length) * 0.6;
}

/* ================= SERVICES CONFIG ================= */
const services: Record<string, { keywords: string[]; weight: number }> = {
  ai_automation: {
    keywords: [
      "ai automation",
      "ai agents",
      "workflow automation",
      "crm automation",
      "chatbot automation",
      "lead automation",
    ],
    weight: 1.2,
  },

  performance_marketing: {
    keywords: [
      "ppc",
      "ads",
      "performance marketing",
      "facebook ads",
      "google ads",
      "increase roas",
      "lower cac",
    ],
    weight: 1.3,
  },

  content_marketing: {
    keywords: [
      "content marketing",
      "copywriting",
      "blogs",
      "lead magnets",
      "seo content",
    ],
    weight: 1,
  },

  social_media: {
    keywords: [
      "instagram",
      "tiktok",
      "linkedin",
      "social media",
      "grow followers",
    ],
    weight: 1,
  },

  website_design: {
    keywords: [
      "website",
      "web design",
      "shopify",
      "woocommerce",
      "landing page",
      "conversion website",
    ],
    weight: 1,
  },

  email_marketing: {
    keywords: [
      "email marketing",
      "email automation",
      "klaviyo",
      "newsletter",
      "cold email",
    ],
    weight: 1,
  },

  cgi_marketing: {
    keywords: [
      "cgi",
      "3d ads",
      "product render",
      "visual ads",
      "3d marketing",
    ],
    weight: 1.1,
  },

  video_audio: {
    keywords: [
      "video editing",
      "video production",
      "audio production",
      "reels",
      "youtube content",
    ],
    weight: 1,
  },

  seo_geo: {
    keywords: [
      "seo",
      "ai seo",
      "geo",
      "chatgpt ranking",
      "gemini ranking",
      "search ranking",
    ],
    weight: 1,
  },

  virtual_tours: {
    keywords: [
      "virtual tours",
      "360 tours",
      "real estate tours",
      "3d tours",
    ],
    weight: 1,
  },

  predictive_analytics: {
    keywords: [
      "analytics",
      "data insights",
      "forecasting",
      "prediction",
    ],
    weight: 1,
  },
};

/* ================= PROBLEM SIGNALS ================= */
const problemSignals = [
  "low roas",
  "no sales",
  "low conversion",
  "ads not working",
  "bad results",
  "traffic but no sales",
];

/* ================= GENERIC ================= */
const leadIntent = ["get more clients", "generate leads"];
const pricingIntent = ["price", "cost", "pricing"];
const consultationIntent = ["book call", "schedule call"];
const marketingGoals = ["grow business", "increase sales", "scale"];

/* ================= SERVICE SCORING ================= */
export async function detectServiceScores(
  text: string
): Promise<Record<string, number>> {
  const scores: Record<string, number> = {};

  for (const [service, config] of Object.entries(services)) {
    let score = 0;

    for (const kw of config.keywords) {
      score += matchKeyword(text, kw);
    }

    score =
      config.keywords.length > 0
        ? (score / config.keywords.length) * config.weight
        : 0;

    if (score > 0.2) {
      scores[service] = Math.min(score, 1);
    }
  }

  return scores;
}

/* ================= MAIN DETECTOR ================= */
export async function detectIntents(
  message: string
): Promise<DetectedIntent[]> {
  const text = normalize(message);
  const results: DetectedIntent[] = [];

  /* PROBLEMS */
  for (const p of problemSignals) {
    if (text.includes(normalize(p))) {
      results.push({ type: "problem", value: p, confidence: 0.9 });
    }
  }

  /* SERVICES */
  const serviceScores = await detectServiceScores(text);

  for (const [service, score] of Object.entries(serviceScores)) {
    results.push({
      type: "service",
      value: service,
      confidence: Number(score.toFixed(2)),
    });
  }

  /* GENERIC */
  const pushIfMatch = (
    list: string[],
    type: DetectedIntent["type"],
    conf: number
  ) => {
    for (const kw of list) {
      if (matchKeyword(text, kw) > 0.7) {
        results.push({ type, value: kw, confidence: conf });
      }
    }
  };

  pushIfMatch(leadIntent, "lead", 0.8);
  pushIfMatch(pricingIntent, "pricing", 0.85);
  pushIfMatch(consultationIntent, "consultation", 0.9);
  pushIfMatch(marketingGoals, "marketing_goal", 0.75);

  if (!results.length) {
    results.push({
      type: "general",
      value: "general",
      confidence: 0.3,
    });
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

/* ================= EXPORTS (CRITICAL FIX) ================= */

// ✅ REQUIRED by bookingFlow + other scripts
export async function detectMultipleServices(
  message: string
): Promise<string[]> {
  const intents = await detectIntents(message);
  return intents
    .filter((i) => i.type === "service")
    .map((i) => i.value);
}

// ✅ REQUIRED by generateHybridResponse
export async function detectService(
  message: string
): Promise<string[]> {
  return detectMultipleServices(message);
}
