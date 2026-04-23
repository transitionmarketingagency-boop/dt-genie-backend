/* =====================================================
   SERVICE DETECTOR — FINAL PRODUCTION STABLE (WIRED FIX)
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

/* ================= MATCH ENGINE ================= */
function matchKeyword(text: string, keyword: string): number {
  const t = normalize(text);
  const k = normalize(keyword);

  if (!k) return 0;

  // exact match (strong signal)
  if (t.includes(k)) return 1;

  // token match (partial signal)
  const words = k.split(" ").filter(Boolean);
  if (!words.length) return 0;

  let hits = 0;
  for (const w of words) {
    if (t.includes(w)) hits++;
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
      "facebook ads",
      "google ads",
      "performance marketing",
      "roas",
      "cac",
    ],
    weight: 1.3,
  },

  content_marketing: {
    keywords: ["content marketing", "copywriting", "blogs", "seo content"],
    weight: 1,
  },

  social_media: {
    keywords: ["instagram", "tiktok", "linkedin", "social media"],
    weight: 1,
  },

  website_design: {
    keywords: ["website", "web design", "shopify", "landing page"],
    weight: 1,
  },

  email_marketing: {
    keywords: ["email marketing", "klaviyo", "newsletter", "cold email"],
    weight: 1,
  },

  cgi_marketing: {
    keywords: ["cgi", "3d ads", "product render", "3d marketing"],
    weight: 1.1,
  },

  video_audio: {
    keywords: ["video editing", "video production", "reels", "youtube"],
    weight: 1,
  },

  seo_geo: {
    keywords: ["seo", "geo", "ai seo", "chatgpt ranking", "search ranking"],
    weight: 1,
  },

  virtual_tours: {
    keywords: ["virtual tours", "360 tours", "real estate tours"],
    weight: 1,
  },

  predictive_analytics: {
    keywords: ["analytics", "data insights", "forecasting", "prediction"],
    weight: 1,
  },
};

/* ================= SIGNALS ================= */
const problemSignals = [
  "low roas",
  "no sales",
  "low conversion",
  "ads not working",
  "bad results",
  "traffic but no sales",
];

const leadIntent = ["get more clients", "generate leads"];
const pricingIntent = ["price", "cost", "pricing"];
const consultationIntent = ["book call", "schedule call"];
const marketingGoals = ["grow business", "increase sales", "scale"];

/* ================= SERVICE SCORING ================= */
export function detectServiceScores(text: string): Record<string, number> {
  const scores: Record<string, number> = {};
  const t = normalize(text);

  for (const [service, config] of Object.entries(services)) {
    let score = 0;

    for (const kw of config.keywords) {
      score += matchKeyword(t, kw);
    }

    if (config.keywords.length > 0) {
      score = (score / config.keywords.length) * config.weight;
    }

    if (score > 0.2) {
      scores[service] = Math.min(score, 1);
    }
  }

  return scores;
}

/* ================= MAIN DETECTOR ================= */
export function detectIntents(message: string): DetectedIntent[] {
  const text = normalize(message);
  const results: DetectedIntent[] = [];

  if (!text) {
    return [{ type: "general", value: "general", confidence: 0.3 }];
  }

  /* ---------------- PROBLEMS ---------------- */
  for (const p of problemSignals) {
    if (text.includes(normalize(p))) {
      results.push({
        type: "problem",
        value: p,
        confidence: 0.9,
      });
    }
  }

  /* ---------------- SERVICES ---------------- */
  const serviceScores = detectServiceScores(text);

  for (const [service, score] of Object.entries(serviceScores)) {
    results.push({
      type: "service",
      value: service,
      confidence: Number(score.toFixed(2)),
    });
  }

  /* ---------------- GENERIC INTENTS ---------------- */
  const pushIfMatch = (
    list: string[],
    type: DetectedIntent["type"],
    conf: number
  ) => {
    for (const kw of list) {
      if (matchKeyword(text, kw) > 0.7) {
        results.push({
          type,
          value: kw,
          confidence: conf,
        });
      }
    }
  };

  pushIfMatch(leadIntent, "lead", 0.8);
  pushIfMatch(pricingIntent, "pricing", 0.85);
  pushIfMatch(consultationIntent, "consultation", 0.9);
  pushIfMatch(marketingGoals, "marketing_goal", 0.75);

  /* ---------------- FALLBACK ---------------- */
  if (results.length === 0) {
    return [
      {
        type: "general",
        value: "general",
        confidence: 0.3,
      },
    ];
  }

  /* ---------------- SORT ---------------- */
  return results.sort((a, b) => b.confidence - a.confidence);
}

/* ================= PUBLIC API ================= */
export function detectMultipleServices(message: string): string[] {
  return detectIntents(message)
    .filter((i) => i.type === "service")
    .map((i) => i.value);
}

export function detectService(message: string): string[] {
  return detectMultipleServices(message);
}
