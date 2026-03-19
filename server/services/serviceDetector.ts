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
    | "general"
    | "redirect"; // NEW: fallback redirect type
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
  const kw = normalize(keyword);

  // exact phrase match (strong signal)
  const exactRegex = new RegExp(`\\b${escapeRegex(kw)}\\b`, "i");
  if (exactRegex.test(text)) return 1;

  // partial token match (weaker signal)
  const words = kw.split(" ");
  let hits = 0;

  for (const w of words) {
    if (text.includes(w)) hits++;
  }

  return (hits / words.length) * 0.6;
}

/* ================= SERVICES ================= */
const services: Record<string, { keywords: string[]; weight: number }> = {
  voice_search: {
    keywords: ["near me now","siri optimization","position zero","alexa search","featured snippets"],
    weight: 1
  },
  email_marketing: {
    keywords: ["klaviyo flows","improve open rates","abandoned cart automation","cold email sequences"],
    weight: 1
  },
  youtube_ads: {
    keywords: ["scale youtube channel","shoppable ads","high-converting scripts","hijack competitor ads"],
    weight: 1
  },
  website_design: {
    keywords: ["fast website","mobile-first","shopify setup","seo-optimized site","website redesign"],
    weight: 1
  },
  virtual_tours: {
    keywords: ["nerf renders","360 property tour","interactive floor plan","virtual staging"],
    weight: 1
  },
  performance_marketing: {
    keywords: ["lower cac","increase roas","ppc management","stop ad bots","real-time bidding"],
    weight: 1
  },
  ai_automation: {
    keywords: ["ai agents","automate workflows","replace saas tools","crm automation","ai assistants"],
    weight: 1
  },
  music_production: {
    keywords: ["radio-ready track","ssl mixing","professional mastering","ghost producer"],
    weight: 1
  },
  cgi_marketing: {
    keywords: ["viral cgi ads","3d product animation","realistic cgi","cgi commercial"],
    weight: 1
  },
  video_audio: {
    keywords: ["dolby atmos audio","retention heatmaps","7-day video production","ai voiceover"],
    weight: 1
  },
  content_marketing: {
    keywords: ["lead magnets","whitepapers","viral hooks","b2b case studies","psychological triggers"],
    weight: 1
  },
  social_media: {
    keywords: ["shadowban fix","instagram reels reach","hack the algorithm","linkedin top stories"],
    weight: 1
  },
  geo_ai_seo: {
    keywords: ["rank on chatgpt","optimize for gemini","ai indexing","ai search seo"],
    weight: 1
  },
  predictive_analytics: {
    keywords: ["market shifts","dark pool flow","sentiment analysis","predict crypto crash","financial reporting"],
    weight: 1
  }
};

/* ================= OTHER INTENTS ================= */
const leadIntent = ["generate leads","get more clients","more customers","increase sales"];
const pricingIntent = ["price","pricing","how much","cost","package"];
const consultationIntent = ["book free audit","schedule call","consultation","strategy session","audit"];
const marketingGoals = ["increase traffic","grow brand","boost visibility","grow online presence"];
const industries = ["real estate","ecommerce","saas","travel","finance","healthcare"];

/* ================= SERVICE DETECTION ================= */
function detectServiceScores(text: string): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const [service, config] of Object.entries(services)) {
    let score = 0;

    for (const kw of config.keywords) {
      score += matchKeyword(text, kw);
    }

    score = (score / config.keywords.length) * config.weight;

    if (score > 0.15) {
      scores[service] = Math.min(score, 1);
    }
  }

  return scores;
}

/* ================= MAIN INTENT DETECTOR ================= */
export function detectIntents(message: string): DetectedIntent[] {
  const text = normalize(message);
  const results: DetectedIntent[] = [];
  const added = new Set<string>();

  /* ---------- MULTI SERVICE DETECTION ---------- */
  const serviceScores = detectServiceScores(text);
  const sortedServices = Object.entries(serviceScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3); // top 3 matches

  for (const [service, score] of sortedServices) {
    results.push({ type: "service", value: service, confidence: Number(score.toFixed(2)) });
    added.add(service);
  }

  /* ---------- OTHER INTENTS ---------- */
  const addIntent = (kws: string[], type: DetectedIntent["type"], conf: number) => {
    for (const kw of kws) {
      if (text.includes(kw) && !added.has(kw)) {
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

  /* ---------- FALLBACK ---------- */
  if (!results.length) {
    results.push({ type: "redirect", value: "general", confidence: 0.3 });
  }

  return results;
}

/* ================= HELPER ================= */
export function detectService(message: string): string | null {
  const intents = detectIntents(message);
  const service = intents.find((i) => i.type === "service");
  return service ? service.value : null;
}

/* ================= MULTI-SERVICE HELPER ================= */
export function detectMultipleServices(message: string): string[] {
  const intents = detectIntents(message);
  return intents.filter((i) => i.type === "service").map((i) => i.value);
}
