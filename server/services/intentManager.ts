/* =====================================================
   INTENT MANAGER (PRODUCTION READY FIX)
   Smart detection: keyword + phrase + intent types + scoring + service awareness
===================================================== */

export interface Intent {
  name: string;
  category: string;
  type: "general" | "problem" | "goal" | "service" | "buying";
  keywords: string[];
  description: string;
}

/* ======================= NORMALIZATION ======================= */
export function normalize(text: string): string {
  return (text || "")
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
  const normText = normalize(text);
  const phraseEscaped = escapeRegex(normalize(phrase));
  const regex = new RegExp(`\\b${phraseEscaped}\\b`, "i");
  return regex.test(normText);
}

/* ======================= STRONG SIGNALS ======================= */
const STRONG_BUYING_SIGNALS = [
  "i want to hire", "i want to work with you", "how do we start",
  "let's start", "ready to begin", "book a call", "schedule a call",
  "get started", "i want to start"
];

const STRONG_GOAL_SIGNALS = [
  "i want to grow", "increase sales", "scale my business",
  "get more customers", "improve conversions"
];

const PROBLEM_SIGNALS = [
  "not working", "low roas", "no sales", "low conversion",
  "ads not working", "bad results", "traffic but no sales"
];

/* ======================= INTENTS DATABASE ======================= */
export const intents: Intent[] = [
  // GENERAL
  { name: "greeting", category: "general", type: "general", keywords: ["hi","hello","hey"], description: "Greeting" },
  { name: "about_company", category: "general", type: "general", keywords: ["who are you","what do you do","your company"], description: "Company info" },

  // GOALS
  { name: "business_growth", category: "sales", type: "goal", keywords: ["grow","scale","increase sales","more revenue"], description: "User wants growth" },

  // PROBLEMS
  { name: "low_roas", category: "marketing", type: "problem", keywords: ["low roas","bad roas","roas is low"], description: "ROAS issue" },
  { name: "no_sales", category: "sales", type: "problem", keywords: ["no sales","not getting sales","zero sales"], description: "Sales problem" },
  { name: "conversion_problem", category: "marketing", type: "problem", keywords: ["low conversion","conversion problem","no conversions"], description: "Conversion issue" },

  // SERVICES
  { name: "voice_search_optimization", category: "service", type: "service", keywords: ["voice search","vso","position zero","featured snippets","alexa","siri","google assistant","aeo","answer engine optimization"], description: "Voice search optimization." },
  { name: "ai_email_marketing", category: "service", type: "service", keywords: ["email marketing","email automation","klaviyo","cold email","newsletter automation"], description: "Email campaigns and automation." },
  { name: "youtube_ad_domination", category: "service", type: "service", keywords: ["youtube ads","video marketing","video funnels","youtube campaigns"], description: "YouTube advertising." },
  { name: "ai_website_design", category: "service", type: "service", keywords: ["website design","shopify","woocommerce","seo website","web development"], description: "Website development services." },
  { name: "ai_virtual_tours", category: "service", type: "service", keywords: ["virtual tours","360 tours","3d tours","real estate renders","cgi tours","interactive floor plans"], description: "Virtual property experiences." },
  { name: "performance_marketing_warfare", category: "service", type: "service", keywords: ["ppc","performance marketing","ads","conversion optimization","lower cac","increase roas"], description: "Paid ads optimization." },
  { name: "immersive_cgi_marketing", category: "service", type: "service", keywords: ["cgi","3d ads","cgi ads","product renders","viral cgi","realistic cgi"], description: "CGI marketing." },
  { name: "ai_video_audio_production", category: "service", type: "service", keywords: ["video production","audio production","editing","content production","ai voiceover","retention heatmaps"], description: "Media production." },
  { name: "ai_optimized_content", category: "service", type: "service", keywords: ["content creation","blogs","copywriting","content marketing","lead magnets"], description: "Content marketing." },
  { name: "ai_social_domination", category: "service", type: "service", keywords: ["social media","instagram","tiktok","linkedin marketing","hack algorithm","shadowban fix"], description: "Social growth." },
  { name: "ai_search_domination_geo", category: "service", type: "service", keywords: ["geo","ai seo","chatgpt ranking","gemini ranking","rank on chatgpt","optimize for gemini","ai indexing"], description: "AI search ranking." },
  { name: "ai_predictive_analytics", category: "service", type: "service", keywords: ["analytics","data","predictive","forecasting","market shifts","sentiment analysis"], description: "Data intelligence." },

  // BUYING
  { name: "hire_intent", category: "sales", type: "buying", keywords: ["hire","work with you","start project"], description: "User wants to hire" },
];

/* ======================= SCORING ======================= */
function calculateIntentScore(text: string, intent: Intent, detectedServices: string[] = []): number {
  let score = 0;

  // Base keyword match
  for (const keyword of intent.keywords) {
    if (containsPhrase(text, keyword)) score += 0.5;
  }

  // Service boost for service intents
  if (intent.type === "service" && detectedServices.length) {
    for (const service of detectedServices) {
      if (intent.name.toLowerCase().includes(service.toLowerCase())) score += 0.4;
    }
  }

  // Normalize score
  if (intent.keywords.length) score /= intent.keywords.length;

  // Short message penalty
  if (text.length < 10) score *= 0.9;

  return Math.min(score, 1);
}

/* ======================= DETECT INTENT ======================= */
export function detectIntent(
  message: string,
  detectedServices: string[] = [],
  topN: number = 3
): { intent: Intent; score: number }[] {
  const text = normalize(message);
  const results: { intent: Intent; score: number }[] = [];

  // Base scoring
  for (const intent of intents) {
    const score = calculateIntentScore(text, intent, detectedServices);
    if (score > 0.05) results.push({ intent, score });
  }

  // Strong signal boosters
  const boosters: { signals: string[]; type: "buying"|"goal"|"problem"; boost: number }[] = [
    { signals: STRONG_BUYING_SIGNALS, type: "buying", boost: 0.6 },
    { signals: STRONG_GOAL_SIGNALS, type: "goal", boost: 0.5 },
    { signals: PROBLEM_SIGNALS, type: "problem", boost: 0.7 },
  ];

  for (const booster of boosters) {
    for (const phrase of booster.signals) {
      if (text.includes(normalize(phrase))) {
        const match = results.find(r => r.intent.type === booster.type);
        if (match) match.score = Math.min(match.score + booster.boost, 1);
        else {
          results.push({
            intent: {
              name: `${booster.type}_signal`,
              category: booster.type,
              type: booster.type,
              keywords: [phrase],
              description: `Strong ${booster.type} signal detected.`
            },
            score: booster.boost,
          });
        }
      }
    }
  }

  // Clamp scores and sort
  results.forEach(r => r.score = Math.min(r.score, 1));
  results.sort((a, b) => b.score - a.score);

  // Fallback only if no strong intent
  if (!results.some(r => r.score >= 0.4)) {
    results.push({
      intent: { name: "general_fallback", category: "general", type: "general", keywords: [], description: "Fallback" },
      score: 0.3
    });
  }

  return results.slice(0, topN);
}

/* ======================= RELEVANT INTENTS ======================= */
export function getRelevantIntents(
  message: string,
  detectedServices: string[] = [],
  limit: number = 3
) {
  return detectIntent(message, detectedServices, limit);
}
