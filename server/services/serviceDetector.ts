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
    | "general"
    | "redirect";
  value: string;
  confidence: number;
};

/* ================= NORMALIZATION ================= */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ================= SMART MATCH ================= */
function matchKeyword(text: string, keyword: string): number {
  const normalizedText = normalize(text);
  const kw = normalize(keyword);

  // Strong exact phrase match
  const exactRegex = new RegExp(`\\b${escapeRegex(kw)}\\b`, "i");
  if (exactRegex.test(normalizedText)) return 1;

  // Token-based partial match
  const words = kw.split(" ");
  let hits = 0;

  for (const w of words) {
    if (normalizedText.includes(w)) hits++;
  }

  return (hits / words.length) * 0.6;
}

/* ================= SERVICES ================= */
const services: Record<string, { keywords: string[]; weight: number }> = {
  voice_search: {
    keywords: ["voice search", "position zero", "featured snippets", "alexa", "siri"],
    weight: 1
  },
  email_marketing: {
    keywords: ["email marketing", "klaviyo", "email automation", "cold email"],
    weight: 1
  },
  youtube_ads: {
    keywords: ["youtube ads", "video marketing", "youtube campaigns"],
    weight: 1
  },
  website_design: {
    keywords: ["website design", "shopify", "woocommerce", "web development"],
    weight: 1
  },
  virtual_tours: {
    keywords: ["virtual tours", "360 tours", "cgi tours", "real estate renders"],
    weight: 1
  },
  performance_marketing: {
    keywords: ["ppc", "performance marketing", "ads", "increase roas", "lower cac"],
    weight: 1.2
  },
  ai_automation: {
    keywords: ["ai agents", "automation", "crm automation", "workflow"],
    weight: 1
  },
  cgi_marketing: {
    keywords: ["cgi", "3d ads", "cgi ads", "product renders"],
    weight: 1.1
  },
  video_audio: {
    keywords: ["video production", "audio production", "editing"],
    weight: 1
  },
  content_marketing: {
    keywords: ["content marketing", "copywriting", "blogs"],
    weight: 1
  },
  social_media: {
    keywords: ["instagram", "tiktok", "linkedin marketing"],
    weight: 1
  },
  geo_ai_seo: {
    keywords: ["geo", "ai seo", "chatgpt ranking", "gemini ranking"],
    weight: 1
  },
  predictive_analytics: {
    keywords: ["analytics", "forecasting", "data insights"],
    weight: 1
  }
};

/* ================= PROBLEM SIGNALS ================= */
const problemSignals = [
  "low roas",
  "bad roas",
  "no sales",
  "low conversion",
  "ads not working",
  "not getting results",
  "traffic but no sales"
];

/* ================= OTHER INTENTS ================= */
const leadIntent = ["generate leads","get more clients","more customers"];
const pricingIntent = ["price","pricing","cost","how much"];
const consultationIntent = ["book call","schedule call","consultation","audit"];
const marketingGoals = ["increase traffic","grow brand","more sales","scale"];
const industries = ["real estate","ecommerce","saas","travel"];

/* ================= SERVICE SCORING ================= */
function detectServiceScores(text: string): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const [service, config] of Object.entries(services)) {
    let score = 0;

    for (const kw of config.keywords) {
      score += matchKeyword(text, kw);
    }

    score = (score / config.keywords.length) * config.weight;

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
  const added = new Set<string>();

  // ---------- PROBLEM DETECTION ----------
  for (const p of problemSignals) {
    if (text.includes(p)) {
      results.push({ type: "problem", value: p, confidence: 0.9 });
      added.add(p);
    }
  }

  // ---------- SERVICE DETECTION ----------
  const serviceScores = detectServiceScores(text);

  for (const [service, score] of Object.entries(serviceScores).sort((a,b)=>b[1]-a[1])) {
    if (!added.has(service)) {
      results.push({ type: "service", value: service, confidence: Number(score.toFixed(2)) });
      added.add(service);
    }
  }

  // ---------- GENERIC INTENTS ----------
  const addIntent = (kws: string[], type: DetectedIntent["type"], conf: number) => {
    for (const kw of kws) {
      if (matchKeyword(text, kw) > 0.7 && !added.has(kw)) {
        results.push({ type, value: kw, confidence: conf });
        added.add(kw);
      }
    }
  };

  addIntent(leadIntent, "lead", 0.8);
  addIntent(pricingIntent, "pricing", 0.85);
  addIntent(consultationIntent, "consultation", 0.9);
  addIntent(marketingGoals, "marketing_goal", 0.75);
  addIntent(industries, "industry", 0.7);

  // ---------- SORT BY CONFIDENCE ----------
  results.sort((a, b) => b.confidence - a.confidence);

  // ---------- FALLBACK ----------
  if (!results.length) {
    return [{ type: "general", value: "general", confidence: 0.3 }];
  }

  return results;
}

/* ================= HELPERS ================= */
export function detectService(message: string): string | null {
  const services = detectMultipleServices(message);
  return services.length ? services[0] : null;
}

export function detectMultipleServices(message: string): string[] {
  return detectIntents(message)
    .filter((i) => i.type === "service")
    .map((i) => i.value);
}
