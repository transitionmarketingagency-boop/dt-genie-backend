/* =====================================================
   INTENT MANAGER (PRODUCTION FIXED + TYPE SAFE)
===================================================== */

export interface Intent {
  name: string;
  category: string;
  type: "general" | "problem" | "goal" | "service" | "buying";
  keywords: string[];
  description: string;
}

/* ================= NORMALIZE ================= */
export function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ================= TOKENIZE ================= */
function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

/* ================= MATCH HELPERS ================= */
function phraseMatch(text: string, phrase: string): boolean {
  return normalize(text).includes(normalize(phrase));
}

function tokenOverlapScore(text: string, keywords: string[]): number {
  const tokens = new Set(tokenize(text));
  let hits = 0;

  for (const kw of keywords) {
    const kwTokens = tokenize(kw);
    if (kwTokens.every(t => tokens.has(t))) hits++;
  }

  return hits / Math.max(keywords.length, 1);
}

/* ================= PRIORITY ================= */
const TYPE_PRIORITY: Record<Intent["type"], number> = {
  buying: 5,
  problem: 4,
  goal: 3,
  service: 2,
  general: 1,
};

/* ================= INTENTS ================= */
export const intents: Intent[] = [
  { name: "greeting", category: "general", type: "general", keywords: ["hi","hello","hey"], description: "Greeting" },
  { name: "about_company", category: "general", type: "general", keywords: ["who are you","what do you do"], description: "Company info" },

  { name: "business_growth", category: "sales", type: "goal", keywords: ["grow","scale","increase sales","more revenue"], description: "Growth intent" },

  { name: "no_sales", category: "sales", type: "problem", keywords: ["no sales","not getting sales","zero sales"], description: "Sales issue" },
  { name: "low_roas", category: "marketing", type: "problem", keywords: ["low roas","bad roas"], description: "ROAS issue" },
  { name: "conversion_problem", category: "marketing", type: "problem", keywords: ["low conversion","no conversions"], description: "Conversion issue" },

  { name: "ai_search_domination_geo", category: "service", type: "service", keywords: ["geo","ai seo","chatgpt ranking"], description: "AI search ranking" },
  { name: "performance_marketing", category: "service", type: "service", keywords: ["ads","ppc","performance marketing"], description: "Paid ads" },
  { name: "ai_automation", category: "service", type: "service", keywords: ["automation","ai automation"], description: "Automation systems" },
  { name: "cgi_tours", category: "service", type: "service", keywords: ["3d tours","virtual tours","cgi"], description: "CGI tours" },

  { name: "hire_intent", category: "sales", type: "buying", keywords: ["hire","work with you","start project","book a call"], description: "Buying intent" },
];

/* ================= SCORING ================= */
function calculateScore(text: string, intent: Intent): number {
  let score = 0;

  for (const kw of intent.keywords) {
    if (phraseMatch(text, kw)) score += 0.6;
  }

  score += tokenOverlapScore(text, intent.keywords) * 0.4;

  return Math.min(score, 1);
}

/* ================= DETECT INTENT ================= */
export function detectIntent(
  message: string,
  detectedServices: string[] = [],
  topN: number = 3
): { intent: Intent; score: number }[] {

  const text = normalize(message);

  if (!text) {
    return [{ intent: intents[0], score: 0.9 }];
  }

  let results: { intent: Intent; score: number }[] = [];

  for (const intent of intents) {
    let score = calculateScore(text, intent);

    /* ================= SERVICE BOOST (TYPE SAFE FIX) ================= */
    if (
      intent.type === "service" &&
      detectedServices.length > 0 &&
      detectedServices.some(s =>
        intent.keywords.some(k =>
          normalize(s).includes(normalize(k))
        )
      )
    ) {
      score += 0.25;
    }

    if (score > 0.25) {
      results.push({ intent, score });
    }
  }

  /* ================= SORT ================= */
  results.sort((a, b) => {
    const pDiff =
      TYPE_PRIORITY[b.intent.type] - TYPE_PRIORITY[a.intent.type];

    return pDiff !== 0 ? pDiff : b.score - a.score;
  });

  /* ================= CLEAN GREETING LOGIC ================= */
  const hasStrongIntent = results.some(
    r => r.score > 0.6 && r.intent.type !== "general"
  );

  if (hasStrongIntent) {
    results = results.filter(r => r.intent.name !== "greeting");
  }

  /* ================= FALLBACK ================= */
  if (results.length === 0) {
    return [{
      intent: {
        name: "general",
        category: "general",
        type: "general",
        keywords: [],
        description: "Fallback"
      },
      score: 0.3
    }];
  }

  return results.slice(0, topN);
}

/* ================= PUBLIC ================= */
export function getRelevantIntents(
  message: string,
  detectedServices: string[] = [],
  limit: number = 3
) {
  return detectIntent(message, detectedServices, limit);
}
