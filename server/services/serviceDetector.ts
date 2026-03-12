// server/services/serviceDetector.ts

export type DetectedIntent = {
  type:
    | "service"
    | "lead"
    | "sales"
    | "pricing"
    | "consultation"
    | "marketing_goal"
    | "industry"
    | "general";
  value: string;
  confidence: number;
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ================= SERVICES ================= */

const services: Record<string, string[]> = {
  voice_search: [
    "voice search",
    "siri optimization",
    "alexa search",
    "featured snippets",
    "position zero",
    "voice seo"
  ],
  email_marketing: [
    "email marketing",
    "klaviyo flows",
    "abandoned cart",
    "cold email",
    "improve open rates",
    "email automation"
  ],
  youtube_ads: [
    "youtube ads",
    "youtube advertising",
    "youtube video ads",
    "scale youtube channel"
  ],
  website_design: [
    "website design",
    "web development",
    "shopify setup",
    "website redesign",
    "seo optimized website",
    "mobile first website"
  ],
  virtual_tours: [
    "virtual tours",
    "360 property tour",
    "nerf render",
    "interactive floor plan",
    "virtual staging"
  ],
  performance_marketing: [
    "ppc",
    "google ads",
    "performance marketing",
    "increase roas",
    "lower cac",
    "ad campaign optimization"
  ],
  ai_automation: [
    "ai automation",
    "ai agents",
    "automate workflows",
    "crm automation",
    "ai assistants"
  ],
  music_production: [
    "music production",
    "mixing",
    "mastering",
    "ghost producer",
    "audio engineering"
  ],
  cgi_marketing: [
    "cgi ads",
    "3d product animation",
    "cgi commercial",
    "viral cgi ads"
  ],
  video_audio: [
    "video production",
    "video editing",
    "ai voiceover",
    "dolby atmos",
    "audio production"
  ],
  content_marketing: [
    "content marketing",
    "blog writing",
    "lead magnets",
    "whitepapers",
    "case studies"
  ],
  social_media: [
    "social media marketing",
    "instagram reels",
    "shadowban",
    "linkedin growth",
    "social media management"
  ],
  geo_ai_seo: [
    "ai seo",
    "generative engine optimization",
    "rank on chatgpt",
    "ai search optimization",
    "gemini ranking"
  ],
  predictive_analytics: [
    "predictive analytics",
    "sentiment analysis",
    "market prediction",
    "dark pool tracking",
    "financial analytics"
  ]
};

/* ================= OTHER INTENTS ================= */

const leadIntent = [
  "generate leads",
  "get more customers",
  "increase sales",
  "attract clients",
  "more bookings",
  "predictable leads"
];

const pricingIntent = [
  "price",
  "pricing",
  "how much",
  "cost",
  "package",
  "budget"
];

const consultationIntent = [
  "book a call",
  "schedule a call",
  "consultation",
  "meeting",
  "strategy session",
  "audit"
];

const marketingGoals = [
  "increase traffic",
  "grow brand",
  "increase engagement",
  "boost visibility",
  "grow online presence"
];

const industries = [
  "real estate",
  "saas",
  "ecommerce",
  "travel",
  "hospitality",
  "finance",
  "healthcare",
  "legal"
];

/* ================= DETECTOR FUNCTIONS ================= */

export function detectIntents(message: string): DetectedIntent[] {
  const text = normalize(message);
  const results: DetectedIntent[] = [];

  // Services
  for (const [service, keywords] of Object.entries(services)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        results.push({ type: "service", value: service, confidence: 0.9 });
        break;
      }
    }
  }

  // Lead
  for (const kw of leadIntent) {
    if (text.includes(kw)) {
      results.push({ type: "lead", value: kw, confidence: 0.8 });
      break;
    }
  }

  // Pricing
  for (const kw of pricingIntent) {
    if (text.includes(kw)) {
      results.push({ type: "pricing", value: kw, confidence: 0.8 });
      break;
    }
  }

  // Consultation
  for (const kw of consultationIntent) {
    if (text.includes(kw)) {
      results.push({ type: "consultation", value: kw, confidence: 0.85 });
      break;
    }
  }

  // Marketing goals
  for (const kw of marketingGoals) {
    if (text.includes(kw)) {
      results.push({ type: "marketing_goal", value: kw, confidence: 0.7 });
      break;
    }
  }

  // Industry
  for (const kw of industries) {
    if (text.includes(kw)) {
      results.push({ type: "industry", value: kw, confidence: 0.7 });
      break;
    }
  }

  if (!results.length) {
    results.push({ type: "general", value: "general", confidence: 0.3 });
  }

  return results;
}

/* ================= SERVICE DETECTION ================= */

/**
 * Returns the most relevant service from a message.
 * If none is detected, returns null.
 */
export function detectService(message: string): string | null {
  const intents = detectIntents(message);
  const serviceIntent = intents.find(i => i.type === "service");
  return serviceIntent ? serviceIntent.value : null;
}
