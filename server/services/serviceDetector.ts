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
if (t.includes(k)) return 1.2; // 🔥 boost exact matches

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

  // 1. AI AUTOMATION
  ai_automation: {
    keywords: [
      "ai automation",
      "ai agents",
      "workflow automation",
      "crm automation",
      "automate business",
      "automation system",
      "replace manual work",
    ],
    weight: 1.3,
  },

  // 2. PERFORMANCE MARKETING
  performance_marketing: {
    keywords: [
      "ppc",
      "ads",
      "facebook ads",
      "google ads",
      "roas",
      "cac",
      "ad performance",
      "fix ads",
    ],
    weight: 1.4,
  },

  // 3. EMAIL MARKETING
  email_marketing: {
    keywords: [
      "email marketing",
      "klaviyo",
      "newsletter",
      "cold email",
      "abandoned cart",
      "email flows",
      "open rates",
    ],
    weight: 1.3,
  },

  // 4. YOUTUBE ADS
  youtube_ads: {
    keywords: [
      "youtube ads",
      "youtube marketing",
      "video ads",
      "scale youtube",
      "youtube funnel",
    ],
    weight: 1.3,
  },

  // 5. WEBSITE DESIGN
  website_design: {
    keywords: [
      "website",
      "web design",
      "shopify",
      "landing page",
      "website redesign",
      "fast website",
    ],
    weight: 1.2,
  },

  // 6. VIRTUAL TOURS
  virtual_tours: {
    keywords: [
      "virtual tours",
      "360 tours",
      "real estate tours",
      "property tour",
      "virtual staging",
    ],
    weight: 1.2,
  },

  // 7. CGI MARKETING
  cgi_marketing: {
    keywords: [
      "cgi",
      "3d ads",
      "product render",
      "cgi ads",
      "3d animation",
    ],
    weight: 1.3,
  },

  // 8. VIDEO / AUDIO
  video_audio: {
    keywords: [
      "video editing",
      "video production",
      "reels",
      "youtube video",
      "audio production",
      "voiceover",
    ],
    weight: 1.1,
  },

  // 9. CONTENT
  content_marketing: {
    keywords: [
      "content marketing",
      "copywriting",
      "blogs",
      "lead magnets",
      "case studies",
    ],
    weight: 1.1,
  },

  // 10. SOCIAL
  social_media: {
    keywords: [
      "instagram",
      "tiktok",
      "linkedin",
      "social media",
      "shadowban",
      "reach",
    ],
    weight: 1.1,
  },

  // 11. GEO / AI SEO
  seo_geo: {
    keywords: [
      "seo",
      "geo",
      "ai seo",
      "chatgpt ranking",
      "voice search",
      "near me search",
    ],
    weight: 1.2,
  },

  // 12. VSO (SEPARATE SIGNAL BOOST)
  voice_search: {
    keywords: [
      "voice search",
      "alexa search",
      "siri search",
      "position zero",
      "featured snippets",
      "near me",
    ],
    weight: 1.3,
  },

  // 13. MUSIC PRODUCTION
  music_production: {
    keywords: [
      "music production",
      "mixing",
      "mastering",
      "track production",
      "ghost producer",
    ],
    weight: 1.0,
  },

  // 14. PREDICTIVE ANALYTICS
  predictive_analytics: {
    keywords: [
      "analytics",
      "forecasting",
      "prediction",
      "market trends",
      "sentiment analysis",
    ],
    weight: 1.2,
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

if (score > 0.35) {
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

// ================= TOP SERVICE FILTER (CRITICAL FIX) =================

// Keep ONLY top 2 strongest services
const topServices = Object.entries(serviceScores)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 2)
  .filter(([_, score]) => score > 0.35);

for (const [service, score] of topServices) {

  // ================= GEO HARD GUARD =================
  if (
    service === "seo_geo" &&
    !text.includes("seo") &&
    !text.includes("geo") &&
    !text.includes("ranking") &&
    !text.includes("search") &&
    !text.includes("chatgpt")
  ) {
    continue; // ❌ block false GEO activation
  }

  // ================= NORMAL SERVICE PUSH =================
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
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 2) // 🔥 LIMIT = better precision
    .map((i) => i.value);
}

export function detectService(message: string): string[] {
  const text = normalize(message);

  // 🔥 HARD OVERRIDE — MUSIC (CRITICAL FIX)
  if (/(music|song|beat|mixing|mastering|audio)/i.test(text)) {
    return ["music_production"];
  }

  return detectMultipleServices(message);
}
