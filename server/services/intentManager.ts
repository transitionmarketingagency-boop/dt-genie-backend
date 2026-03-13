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

/* ======================= INTENTS DATABASE ======================= */

export const intents: Intent[] = [

  /* -------------------- SERVICES -------------------- */

  {
    name: "voice_search_optimization",
    category: "service",
    keywords: [
      "voice search", "vso", "position zero", "featured snippets",
      "conversational queries", "alexa", "siri", "google assistant",
      "aeo", "answer engine optimization", "voice rank tracking"
    ],
    description: "Optimizing content for conversational voice queries and securing top results on AI assistants."
  },

  {
    name: "ai_email_marketing",
    category: "service",
    keywords: [
      "email marketing", "email automation", "klaviyo", "cold email",
      "abandoned cart", "b2b pipeline accelerator", "deliverability shield",
      "email audits", "newsletter automation"
    ],
    description: "AI-optimized email campaigns and automated sequences designed to increase open rates and revenue."
  },

  {
    name: "youtube_ad_domination",
    category: "service",
    keywords: [
      "youtube ads", "video funnels", "ad scripts", "shoppable video",
      "competitor ad cloning", "skip ad waste", "bid surgery"
    ],
    description: "Transforming video ads into profit machines using AI scripts and hyper-targeted placement."
  },

  {
    name: "ai_website_design",
    category: "service",
    keywords: [
      "website design", "mobile-first", "seo optimized", "shopify",
      "woocommerce", "load times", "e-commerce development", "website maintenance"
    ],
    description: "High-converting websites built with built-in SEO and AI-driven design processes."
  },

  {
    name: "ai_virtual_tours",
    category: "service",
    keywords: [
      "virtual tours", "nerf rendering", "lidar", "photorealistic",
      "360 spins", "dynamic staging", "matterport migration", "off-plan renders"
    ],
    description: "Creating immersive, high-resolution virtual property experiences with interactive AI hotspots."
  },

  {
    name: "performance_marketing_warfare",
    category: "service",
    keywords: [
      "performance marketing", "ppc", "real-time bidding", "predictive targeting",
      "ad warfare", "algorithmic ad domination", "conversion rate optimization", "creative fatigue detection"
    ],
    description: "Autonomous AI-driven paid media management across Google, Meta, and programmatic DSPs."
  },

  {
    name: "immersive_cgi_marketing",
    category: "service",
    keywords: [
      "cgi marketing", "cgi ads", "3d animation", "viral ar effects",
      "product renders", "cgi commercials", "special effects"
    ],
    description: "High-fidelity 3D visual content and animations designed for maximum engagement and conversion."
  },

  {
    name: "ai_video_audio_production",
    category: "service",
    keywords: [
      "video production", "audio production", "spatial audio", "dolby atmos",
      "retention heatmaps", "conversion editing", "eye-tracking algorithms"
    ],
    description: "Technical video and audio editing optimized for viewer retention and emotional impact."
  },

  {
    name: "ai_optimized_content",
    category: "service",
    keywords: [
      "content creation", "blog writing", "whitepapers", "case studies",
      "conversion triggers", "multi-format content", "lead magnets"
    ],
    description: "Data-backed content engineering focused on psychological triggers and lead generation."
  },

  {
    name: "ai_social_domination",
    category: "service",
    keywords: [
      "social media management", "linkedin feed hijacking", "tiktok shadowban",
      "reels reach", "community management", "algorithm hacking", "audience mining"
    ],
    description: "Managing social platforms by exploiting algorithms to maximize reach and reverse shadowbans."
  },

  {
    name: "ai_search_domination_geo",
    category: "service",
    keywords: [
      "geo", "generative engine optimization", "chatgpt ranking", "gemini ranking",
      "ai seo", "ai search indexing", "plagiarism shield"
    ],
    description: "Forcing brand visibility and rankings within AI-generated search results and conversational engines."
  },

  {
    name: "ai_predictive_analytics",
    category: "service",
    keywords: [
      "predictive analytics", "market foresight", "sentiment analysis",
      "dark pool tracking", "data intelligence", "hedge fund-grade dashboards",
      "whale tracking"
    ],
    description: "Harnessing real-time data feeds to predict market shifts and institutional movements before they occur."
  },

  /* -------------------- MARKETING -------------------- */

  {
    name: "campaign_optimization",
    category: "marketing",
    keywords: [
      "ad creatives", "campaign optimization", "creative fatigue", "ad rotation",
      "creative testing", "rpm optimization", "dynamic creative optimization"
    ],
    description: "AI-driven refinement of ad assets and bidding strategies to prevent performance decay."
  },

  {
    name: "competitor_warfare",
    category: "marketing",
    keywords: [
      "competitor ad interception", "competitor gap analysis", "competitor hijacking",
      "sabotage strategies", "market anomalies"
    ],
    description: "Aggressive strategies to identify and exploit rival vulnerabilities in the digital marketplace."
  },

  /* -------------------- LEAD GENERATION -------------------- */

  {
    name: "lead_generation_intents",
    category: "lead_generation",
    keywords: [
      "lead generation", "lead scoring", "pipeline management", "lead capture",
      "landing pages", "conversion copy", "nurture system", "opt-in forms", "lead magnet funnels"
    ],
    description: "Strategic intents focused on identifying, capturing, and qualifying high-value prospects."
  },

  /* -------------------- SALES -------------------- */

  {
    name: "sales_intents",
    category: "sales",
    keywords: [
      "roi maximization", "sales goals", "pipeline growth", "b2b sales",
      "high-intent shoppers", "purchase intent", "upselling", "cross-selling"
    ],
    description: "Intents focused on converting leads into revenue and aligning marketing with sales targets."
  },

  /* -------------------- AI AUTOMATION -------------------- */

  {
    name: "ai_business_automation",
    category: "ai_automation",
    keywords: [
      "ai automation", "ai agents", "self-healing workflows", "crm integration",
      "process automation", "automation spine", "intelligent process automation",
      "workflow orchestration", "autonomous engagement", "battle ready execution"
    ],
    description: "Consolidating fragmented tools into unified, self-healing AI cores to automate business workflows."
  },

  {
    name: "ai_chatbots",
    category: "ai_automation",
    keywords: [
      "chatbots", "customer support automation", "nlp bots", "conversational ai"
    ],
    description: "AI-powered chatbots for lead qualification, support, and sales conversion."
  },

  {
    name: "ai_data_insights",
    category: "ai_automation",
    keywords: [
      "analytics", "ai insights", "business intelligence", "data dashboards"
    ],
    description: "Automated data processing and insights generation to inform marketing and sales strategy."
  }

];

/* ======================= DETECTION FUNCTIONS ======================= */

export function detectIntent(message: string, topN: number = 1) {

  const text = normalize(message);

  const matches: {
    intent: Intent;
    score: number;
    matchedKeywords: string[];
  }[] = [];

  for (const intent of intents) {

    const matched = new Set<string>();

    for (const kw of intent.keywords) {

      const kwNorm = normalize(kw);

      const escaped =
        kwNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const regex =
        new RegExp(`\\b${escaped}\\b`, "i");

      if (regex.test(text)) {
        matched.add(kwNorm);
      }

    }

    if (matched.size > 0) {

      const score =
        Math.min(matched.size / Math.max(intent.keywords.length, 3), 1);

      matches.push({
        intent,
        score,
        matchedKeywords: [...matched]
      });

    }

  }

  matches.sort((a, b) => b.score - a.score);

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
