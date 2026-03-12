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
    "voice seo",
    "alexa search",
    "siri search",
    "featured snippet",
    "position zero"
  ],

  email_marketing: [
    "email marketing",
    "email automation",
    "email flows",
    "cold email",
    "klaviyo",
    "abandoned cart"
  ],

  youtube_ads: [
    "youtube ads",
    "youtube advertising",
    "youtube marketing",
    "video ads"
  ],

  website_design: [
    "website design",
    "web design",
    "web development",
    "shopify store",
    "website redesign",
    "build website"
  ],

  virtual_tours: [
    "virtual tour",
    "360 tour",
    "property tour",
    "interactive floor plan",
    "nerf render",
    "real estate tour"
  ],

  performance_marketing: [
    "performance marketing",
    "google ads",
    "ppc",
    "paid ads",
    "paid media",
    "ad campaign",
    "increase roas"
  ],

  ai_automation: [
    "ai automation",
    "ai agents",
    "automate workflows",
    "business automation",
    "crm automation"
  ],

  music_production: [
    "music production",
    "mixing",
    "mastering",
    "audio engineering"
  ],

  cgi_marketing: [
    "cgi advertising",
    "cgi marketing",
    "cgi ads",
    "3d advertising",
    "3d product animation",
    "cgi commercial"
  ],

  video_audio: [
    "video production",
    "video editing",
    "audio production",
    "voiceover",
    "dolby atmos"
  ],

  content_marketing: [
    "content marketing",
    "blog writing",
    "content strategy",
    "lead magnets",
    "whitepapers"
  ],

  social_media: [
    "social media",
    "instagram marketing",
    "tiktok marketing",
    "linkedin growth",
    "social media management"
  ],

  geo_ai_seo: [
    "ai seo",
    "generative engine optimization",
    "geo seo",
    "rank on chatgpt",
    "ai search ranking"
  ],

  predictive_analytics: [
    "predictive analytics",
    "market prediction",
    "sentiment analysis",
    "financial analytics"
  ]
};

/* ================= OTHER INTENTS ================= */

const leadIntent = [
  "generate leads",
  "get more clients",
  "more customers",
  "increase sales",
  "predictable leads"
];

const pricingIntent = [
  "price",
  "pricing",
  "how much",
  "cost",
  "package"
];

const consultationIntent = [
  "book call",
  "schedule call",
  "consultation",
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
  "ecommerce",
  "saas",
  "travel",
  "hospitality",
  "finance",
  "healthcare",
  "legal",
  "medical aesthetics"
];

/* ================= SERVICE DETECTION ================= */

function detectServiceScore(text: string) {

  const scores: Record<string, number> = {};

  for (const [service, keywords] of Object.entries(services)) {

    let score = 0;

    for (const kw of keywords) {

      if (text.includes(kw)) {
        score += 1;
      }

    }

    if (score > 0) {
      scores[service] = score;
    }

  }

  return scores;

}

/* ================= MAIN INTENT DETECTOR ================= */

export function detectIntents(message: string): DetectedIntent[] {

  const text = normalize(message);
  const results: DetectedIntent[] = [];

  const serviceScores = detectServiceScore(text);

  if (Object.keys(serviceScores).length) {

    const bestService = Object.entries(serviceScores)
      .sort((a, b) => b[1] - a[1])[0];

    results.push({
      type: "service",
      value: bestService[0],
      confidence: Math.min(bestService[1] / 3, 1)
    });

  }

  for (const kw of leadIntent) {
    if (text.includes(kw)) {
      results.push({ type: "lead", value: kw, confidence: 0.8 });
    }
  }

  for (const kw of pricingIntent) {
    if (text.includes(kw)) {
      results.push({ type: "pricing", value: kw, confidence: 0.8 });
    }
  }

  for (const kw of consultationIntent) {
    if (text.includes(kw)) {
      results.push({ type: "consultation", value: kw, confidence: 0.85 });
    }
  }

  for (const kw of marketingGoals) {
    if (text.includes(kw)) {
      results.push({ type: "marketing_goal", value: kw, confidence: 0.7 });
    }
  }

  for (const kw of industries) {
    if (text.includes(kw)) {
      results.push({ type: "industry", value: kw, confidence: 0.7 });
    }
  }

  if (!results.length) {
    results.push({ type: "general", value: "general", confidence: 0.3 });
  }

  return results;

}

/* ================= HELPER ================= */

export function detectService(message: string): string | null {

  const intents = detectIntents(message);

  const service = intents.find(i => i.type === "service");

  return service ? service.value : null;

}
