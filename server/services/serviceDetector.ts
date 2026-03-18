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

  return hits / words.length * 0.6;
}

/* ================= SERVICES ================= */

const services: Record<string, { keywords: string[]; weight: number }> = {
  voice_search: {
    keywords: ["voice search","voice seo","alexa search","siri search","featured snippet","position zero"],
    weight: 1
  },
  email_marketing: {
    keywords: ["email marketing","email automation","email flows","cold email","klaviyo","abandoned cart"],
    weight: 1
  },
  youtube_ads: {
    keywords: ["youtube ads","youtube advertising","video ads"],
    weight: 1.1
  },
  website_design: {
    keywords: ["website design","web development","shopify store","build website","website redesign"],
    weight: 1
  },
  virtual_tours: {
    keywords: ["virtual tour","360 tour","property tour","real estate tour","interactive floor plan"],
    weight: 1.2
  },
  performance_marketing: {
    keywords: ["google ads","ppc","paid ads","paid media","ad campaign","increase roas"],
    weight: 1.3
  },
  ai_automation: {
    keywords: ["ai automation","ai agents","automate workflows","crm automation"],
    weight: 1.3
  },
  music_production: {
    keywords: ["music production","mixing","mastering","audio engineering"],
    weight: 0.9
  },
  cgi_marketing: {
    keywords: ["cgi advertising","cgi ads","3d advertising","3d animation","cgi commercial"],
    weight: 1.4
  },
  video_audio: {
    keywords: ["video production","video editing","audio production","voiceover"],
    weight: 1
  },
  content_marketing: {
    keywords: ["content marketing","blog writing","content strategy","lead magnets"],
    weight: 1
  },
  social_media: {
    keywords: ["social media","instagram marketing","tiktok marketing","linkedin growth"],
    weight: 1
  },
  geo_ai_seo: {
    keywords: ["ai seo","geo seo","rank on chatgpt","ai search ranking"],
    weight: 1.5
  },
  predictive_analytics: {
    keywords: ["predictive analytics","market prediction","sentiment analysis"],
    weight: 1.2
  }
};

/* ================= OTHER INTENTS ================= */

const leadIntent = ["generate leads","get more clients","more customers","increase sales"];
const pricingIntent = ["price","pricing","how much","cost","package"];
const consultationIntent = ["book call","schedule call","consultation","strategy session","audit"];
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
    .slice(0, 3); // allow top 3 services

  for (const [service, score] of sortedServices) {
    results.push({
      type: "service",
      value: service,
      confidence: Number(score.toFixed(2))
    });
    added.add(service);
  }

  /* ---------- OTHER INTENTS ---------- */
  const addIntent = (
    kws: string[],
    type: DetectedIntent["type"],
    conf: number
  ) => {
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
    results.push({
      type: "general",
      value: "general",
      confidence: 0.3
    });
  }

  return results;
}

/* ================= HELPER ================= */

export function detectService(message: string): string | null {
  const intents = detectIntents(message);
  const service = intents.find((i) => i.type === "service");
  return service ? service.value : null;
}

/* ================= NEW (IMPORTANT) ================= */
/* MULTI-SERVICE HELPER FOR ADVANCED SYSTEM */

export function detectMultipleServices(message: string): string[] {
  const intents = detectIntents(message);
  return intents
    .filter((i) => i.type === "service")
    .map((i) => i.value);
}
