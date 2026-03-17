/* =====================================================
   INTENT MANAGER
   Consolidates services, marketing, sales, lead gen, AI automation
   Provides keyword-based detection for hybrid RAG system
   Strict TS, dynamic scoring, and extended intents
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
    description: "General information about the company or assistant."
  },

  /* -------------------- SERVICES -------------------- */

  {
    name: "voice_search_optimization",
    category: "service",
    keywords: [
      "voice search","vso","position zero","featured snippets",
      "conversational queries","alexa","siri","google assistant",
      "aeo","answer engine optimization","voice rank tracking"
    ],
    description: "Optimizing content for conversational voice queries and securing top results on AI assistants."
  },

  {
    name: "ai_email_marketing",
    category: "service",
    keywords: [
      "email marketing","email automation","klaviyo","cold email",
      "abandoned cart","b2b pipeline accelerator","deliverability shield",
      "email audits","newsletter automation"
    ],
    description: "AI-optimized email campaigns and automated sequences."
  },

  {
    name: "youtube_ad_domination",
    category: "service",
    keywords: [
      "youtube ads","video funnels","video advertising",
      "youtube campaigns","youtube video ads",
      "video marketing","video ad strategy",
      "youtube ad optimization","video conversion funnels"
    ],
    description: "Strategic YouTube advertising campaigns."
  },

  {
    name: "ai_website_design",
    category: "service",
    keywords: [
      "website design","mobile first","seo optimized","shopify",
      "woocommerce","load times","e commerce development","website maintenance"
    ],
    description: "High-converting websites built with SEO and AI design processes."
  },

  {
    name: "ai_virtual_tours",
    category: "service",
    keywords: [
      "virtual tours","nerf rendering","lidar","photorealistic",
      "360 spins","dynamic staging","matterport migration","off plan renders"
    ],
    description: "Immersive virtual property experiences."
  },

  {
    name: "performance_marketing_warfare",
    category: "service",
    keywords: [
      "performance marketing","ppc","real time bidding",
      "predictive targeting","conversion rate optimization",
      "creative fatigue detection"
    ],
    description: "AI-driven paid media optimization."
  },

  {
    name: "immersive_cgi_marketing",
    category: "service",
    keywords: [
      "cgi marketing","cgi ads","3d animation",
      "viral ar effects","product renders","cgi commercials"
    ],
    description: "High-fidelity CGI marketing content."
  },

  {
    name: "ai_video_audio_production",
    category: "service",
    keywords: [
      "video production","audio production","spatial audio",
      "dolby atmos","retention heatmaps","conversion editing"
    ],
    description: "Video and audio production optimized for retention."
  },

  {
    name: "ai_optimized_content",
    category: "service",
    keywords: [
      "content creation","blog writing","whitepapers",
      "case studies","lead magnets","conversion triggers"
    ],
    description: "Conversion-focused content marketing."
  },

  {
    name: "ai_social_domination",
    category: "service",
    keywords: [
      "social media management","linkedin marketing",
      "tiktok growth","reels reach",
      "community management","audience mining"
    ],
    description: "Social media growth and algorithm optimization."
  },

  {
    name: "ai_search_domination_geo",
    category: "service",
    keywords: [
      "geo","generative engine optimization","chatgpt ranking",
      "gemini ranking","ai seo","ai search indexing"
    ],
    description: "Ranking brands in AI-driven search engines."
  },

  {
    name: "ai_predictive_analytics",
    category: "service",
    keywords: [
      "predictive analytics","sentiment analysis",
      "data intelligence","market forecasting","data dashboards"
    ],
    description: "Advanced predictive business analytics."
  },

  /* -------------------- MARKETING -------------------- */

  {
    name: "campaign_optimization",
    category: "marketing",
    keywords: [
      "ad creatives","campaign optimization",
      "creative fatigue","creative testing",
      "dynamic creative optimization"
    ],
    description: "AI-driven ad optimization."
  },

  {
    name: "competitor_warfare",
    category: "marketing",
    keywords: [
      "competitor analysis","competitor gap analysis",
      "competitor strategy","market competition"
    ],
    description: "Competitive marketing strategy."
  },

  /* -------------------- LEAD GENERATION -------------------- */

  {
    name: "lead_generation_intents",
    category: "lead_generation",
    keywords: [
      "lead generation","lead capture","lead magnet",
      "pipeline management","landing pages",
      "conversion copy","opt in forms"
    ],
    description: "Lead acquisition and nurturing."
  },

  /* -------------------- SALES -------------------- */

  {
    name: "sales_intents",
    category: "sales",
    keywords: [
      "roi","sales growth","pipeline growth",
      "purchase intent","upselling","cross selling"
    ],
    description: "Revenue and sales optimization."
  },

  /* -------------------- AI AUTOMATION -------------------- */

  {
    name: "ai_business_automation",
    category: "ai_automation",
    keywords: [
      "ai automation","ai agents","process automation",
      "workflow automation","crm integration",
      "workflow orchestration"
    ],
    description: "Business automation with AI systems."
  },

  {
    name: "ai_chatbots",
    category: "ai_automation",
    keywords: [
      "chatbot","chatbots","conversational ai",
      "customer support automation"
    ],
    description: "AI chatbots for automation."
  },

  {
    name: "ai_data_insights",
    category: "ai_automation",
    keywords: [
      "analytics","ai insights",
      "business intelligence","data dashboards"
    ],
    description: "Automated business intelligence."
  }

];

/* ======================= INTENT DETECTION ======================= */

export function detectIntent(
  message: string,
  topN: number = 3
) {

  const text = normalize(message);

  const matches: {
    intent: Intent;
    score: number;
    matchedKeywords: string[];
  }[] = [];

  for (const intent of intents) {

    const matched = new Set<string>();

    for (const keyword of intent.keywords) {

      const kw = normalize(keyword);

      const regex =
        new RegExp(`\\b${escapeRegex(kw)}\\b`, "i");

      if (regex.test(text)) {
        matched.add(kw);
      }

    }

    if (matched.size > 0) {

      const keywordCoverage =
        matched.size / intent.keywords.length;

      const score =
        Math.min(
          keywordCoverage * 1.5,
          1
        );

      matches.push({
        intent,
        score,
        matchedKeywords: [...matched]
      });

    }

  }

  matches.sort((a, b) => b.score - a.score);

  if (process.env.DEBUG_INTENTS === "true") {
    console.log(
      "[IntentManager]",
      matches.slice(0, topN)
    );
  }

  return matches.slice(0, topN);

}

/* ======================= HELPERS ======================= */

export function getIntentByName(name: string): Intent | undefined {
  return intents.find(i => i.name === name);
}

export function getRelevantIntents(
  message: string,
  limit: number = 3
) {
  return detectIntent(message, limit);
}
