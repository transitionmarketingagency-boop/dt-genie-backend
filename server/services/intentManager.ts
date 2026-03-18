/* =====================================================
   INTENT MANAGER (FINAL PRODUCTION VERSION)
   Hybrid detection: keyword + phrase + scoring + intent boosting
===================================================== */

export interface Intent {
  name: string;
  category: string;
  keywords: string[];
  description: string;
}

/* ======================= NORMALIZATION ======================= */

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ======================= UTILS ======================= */

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsPhrase(text: string, phrase: string): boolean {
  return text.includes(normalize(phrase));
}

/* ======================= STRONG BUYING SIGNALS ======================= */

const STRONG_INTENT_PHRASES = [
  "i want to hire",
  "i want to work with you",
  "how do we start",
  "let's start",
  "ready to begin",
  "book a call",
  "schedule a call",
  "get started",
];

/* ======================= INTENTS DATABASE ======================= */

export const intents: Intent[] = [

  /* -------------------- GENERAL -------------------- */

  {
    name: "general_greeting",
    category: "general",
    keywords: ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"],
    description: "General greeting or introduction."
  },

  {
    name: "general_question",
    category: "general",
    keywords: ["what do you do", "who are you", "what services", "what can you do"],
    description: "General info about company or assistant."
  },

  /* -------------------- SERVICES -------------------- */

  {
    name: "voice_search_optimization",
    category: "service",
    keywords: ["voice search","vso","position zero","featured snippets","alexa","siri","google assistant","aeo","answer engine optimization"],
    description: "Voice search optimization."
  },

  {
    name: "ai_email_marketing",
    category: "service",
    keywords: ["email marketing","email automation","klaviyo","cold email","newsletter automation"],
    description: "Email campaigns and automation."
  },

  {
    name: "youtube_ad_domination",
    category: "service",
    keywords: ["youtube ads","video marketing","video funnels","youtube campaigns"],
    description: "YouTube advertising."
  },

  {
    name: "ai_website_design",
    category: "service",
    keywords: ["website design","shopify","woocommerce","seo website","web development"],
    description: "Website development services."
  },

  {
    name: "ai_virtual_tours",
    category: "service",
    keywords: ["virtual tours","360 tours","3d tours","real estate renders"],
    description: "Virtual property experiences."
  },

  {
    name: "performance_marketing_warfare",
    category: "service",
    keywords: ["ppc","performance marketing","ads","conversion optimization"],
    description: "Paid ads optimization."
  },

  {
    name: "immersive_cgi_marketing",
    category: "service",
    keywords: ["cgi","3d ads","cgi ads","product renders"],
    description: "CGI marketing."
  },

  {
    name: "ai_video_audio_production",
    category: "service",
    keywords: ["video production","audio production","editing","content production"],
    description: "Media production."
  },

  {
    name: "ai_optimized_content",
    category: "service",
    keywords: ["content creation","blogs","copywriting","content marketing"],
    description: "Content marketing."
  },

  {
    name: "ai_social_domination",
    category: "service",
    keywords: ["social media","instagram","tiktok","linkedin marketing"],
    description: "Social growth."
  },

  {
    name: "ai_search_domination_geo",
    category: "service",
    keywords: ["geo","ai seo","chatgpt ranking","gemini ranking"],
    description: "AI search ranking."
  },

  {
    name: "ai_predictive_analytics",
    category: "service",
    keywords: ["analytics","data","predictive","forecasting"],
    description: "Data intelligence."
  },

  /* -------------------- MARKETING -------------------- */

  {
    name: "campaign_optimization",
    category: "marketing",
    keywords: ["campaign optimization","ad creatives","creative testing"],
    description: "Ad optimization."
  },

  {
    name: "competitor_warfare",
    category: "marketing",
    keywords: ["competitor analysis","competition","market research"],
    description: "Competitive strategy."
  },

  /* -------------------- LEAD GENERATION -------------------- */

  {
    name: "lead_generation_intents",
    category: "lead_generation",
    keywords: ["lead generation","leads","pipeline","conversion","landing page"],
    description: "Lead generation."
  },

  /* -------------------- SALES -------------------- */

  {
    name: "sales_intents",
    category: "sales",
    keywords: ["roi","sales","revenue","growth","increase sales"],
    description: "Sales optimization."
  },

  /* -------------------- AI AUTOMATION -------------------- */

  {
    name: "ai_business_automation",
    category: "ai_automation",
    keywords: ["automation","ai agents","workflow","crm"],
    description: "Automation systems."
  },

  {
    name: "ai_chatbots",
    category: "ai_automation",
    keywords: ["chatbot","chatbots","ai assistant"],
    description: "Chatbot systems."
  },

  {
    name: "ai_data_insights",
    category: "ai_automation",
    keywords: ["data insights","analytics dashboard","business intelligence"],
    description: "AI insights."
  }

];

/* ======================= SCORING ENGINE ======================= */

function calculateIntentScore(text: string, intent: Intent) {
  const matched = new Set<string>();
  let phraseBoost = 0;
  let repetitionBoost = 0;

  for (const keyword of intent.keywords) {
    const kw = normalize(keyword);

    const regex = new RegExp(`\\b${escapeRegex(kw)}\\b`, "i");

    if (regex.test(text)) {
      matched.add(kw);

      const occurrences = text.split(kw).length - 1;
      if (occurrences > 1) {
        repetitionBoost += 0.05 * occurrences;
      }
    }

    if (containsPhrase(text, kw)) {
      phraseBoost += 0.1;
    }
  }

  if (matched.size === 0) {
    return { score: 0, matchedKeywords: [] };
  }

  const keywordCoverage = matched.size / intent.keywords.length;

  let score =
    keywordCoverage * 1.2 +
    phraseBoost +
    repetitionBoost;

  if (text.length < 20) {
    score *= 0.85;
  }

  return {
    score: Math.min(score, 1),
    matchedKeywords: [...matched],
  };
}

/* ======================= INTENT DETECTION ======================= */

export function detectIntent(message: string, topN: number = 3) {
  const text = normalize(message);

  const matches: {
    intent: Intent;
    score: number;
    matchedKeywords: string[];
  }[] = [];

  const isStrongIntent = STRONG_INTENT_PHRASES.some(p =>
    text.includes(p)
  );

  for (const intent of intents) {
    const { score, matchedKeywords } =
      calculateIntentScore(text, intent);

    if (score > 0) {
      matches.push({
        intent,
        score,
        matchedKeywords,
      });
    }
  }

  /* ===== BOOST BUYING SIGNALS ===== */
  if (isStrongIntent) {
    matches.forEach(m => {
      if (
        m.intent.category === "sales" ||
        m.intent.category === "lead_generation"
      ) {
        m.score = Math.min(m.score + 0.3, 1);
      }
    });
  }

  matches.sort((a, b) => b.score - a.score);

  /* ===== FALLBACK ===== */
  if (matches.length === 0) {
    return [{
      intent: {
        name: "general_fallback",
        category: "general",
        keywords: [],
        description: "Fallback intent"
      },
      score: 0.3,
      matchedKeywords: []
    }];
  }

  if (process.env.DEBUG_INTENTS === "true") {
    console.log("[IntentManager FINAL]", matches.slice(0, topN));
  }

  return matches.slice(0, topN);
}

/* ======================= HELPERS ======================= */

export function getIntentByName(name: string): Intent | undefined {
  return intents.find(i => i.name === name);
}

export function getRelevantIntents(message: string, limit: number = 3) {
  return detectIntent(message, limit);
}
