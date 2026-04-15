/* =====================================================
   INTENT MANAGER (ULTRA STABLE PRODUCTION VERSION)
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
    if (kwTokens.every(t => tokens.has(t))) {
      hits++;
    }
  }

  return hits / Math.max(keywords.length, 1);
}

/* ================= STRONG SIGNALS ================= */
const STRONG_BUYING_SIGNALS = [
  "i want to hire",
  "i want to work with you",
  "how do we start",
  "let's start",
  "ready to begin",
  "book a call",
  "schedule a call",
  "get started",
  "start project",
];

const STRONG_GOAL_SIGNALS = [
  "increase sales",
  "get more leads",
  "grow my business",
  "scale my business",
  "improve conversions",
];

const STRONG_PROBLEM_SIGNALS = [
  "no sales",
  "low sales",
  "low roas",
  "ads not working",
  "bad results",
  "no leads",
  "traffic but no sales",
];

/* ================= INTENTS ================= */
export const intents: Intent[] = [
  { name: "greeting", category: "general", type: "general", keywords: ["hi","hello","hey"], description: "Greeting" },
  { name: "about_company", category: "general", type: "general", keywords: ["who are you","what do you do","your company"], description: "Company info" },

  { name: "business_growth", category: "sales", type: "goal", keywords: ["grow","scale","increase sales","more revenue"], description: "Growth intent" },

  { name: "no_sales", category: "sales", type: "problem", keywords: ["no sales","not getting sales","zero sales"], description: "Sales issue" },
  { name: "low_roas", category: "marketing", type: "problem", keywords: ["low roas","bad roas"], description: "ROAS issue" },
  { name: "conversion_problem", category: "marketing", type: "problem", keywords: ["low conversion","no conversions"], description: "Conversion issue" },

  { name: "ai_search_domination_geo", category: "service", type: "service", keywords: ["geo","ai seo","chatgpt ranking","gemini ranking"], description: "AI search ranking" },
  { name: "performance_marketing", category: "service", type: "service", keywords: ["ads","ppc","performance marketing"], description: "Paid ads" },
  { name: "ai_automation", category: "service", type: "service", keywords: ["automation","ai automation","workflow automation"], description: "Automation systems" },
  { name: "cgi_tours", category: "service", type: "service", keywords: ["3d tours","virtual tours","cgi"], description: "CGI tours" },

  { name: "hire_intent", category: "sales", type: "buying", keywords: ["hire","work with you","start project"], description: "Buying intent" },
];

/* ================= PRIORITY ================= */
const TYPE_PRIORITY = {
  buying: 5,
  problem: 4,
  goal: 3,
  service: 2,
  general: 1,
};

/* ================= SCORING ================= */
function calculateScore(text: string, intent: Intent): number {
  let score = 0;

  // phrase match (strong)
  for (const kw of intent.keywords) {
    if (phraseMatch(text, kw)) {
      score += 0.6;
    }
  }

  // token overlap (soft)
  score += tokenOverlapScore(text, intent.keywords) * 0.5;

  return Math.min(score, 1);
}

/* ================= STRONG SIGNAL BOOST ================= */
function applyStrongSignals(
  text: string,
  results: { intent: Intent; score: number }[]
) {
  const boost = (
    signals: string[],
    type: Intent["type"],
    value: number
  ) => {
    for (const phrase of signals) {
      if (phraseMatch(text, phrase)) {
        results.push({
          intent: {
            name: `${type}_signal`,
            category: type,
            type,
            keywords: [phrase],
            description: `Strong ${type}`,
          },
          score: value,
        });
      }
    }
  };

  boost(STRONG_BUYING_SIGNALS, "buying", 0.95);
  boost(STRONG_PROBLEM_SIGNALS, "problem", 0.85);
  boost(STRONG_GOAL_SIGNALS, "goal", 0.75);
}

/* ================= CLEAN + PRIORITIZE ================= */
function cleanResults(results: { intent: Intent; score: number }[]) {
  const map = new Map<string, { intent: Intent; score: number }>();

  for (const r of results) {
    const existing = map.get(r.intent.name);
    if (!existing || existing.score < r.score) {
      map.set(r.intent.name, r);
    }
  }

  return Array.from(map.values())
    .sort((a, b) => {
      const pDiff =
        TYPE_PRIORITY[b.intent.type] - TYPE_PRIORITY[a.intent.type];

      if (pDiff !== 0) return pDiff;

      return b.score - a.score;
    });
}

/* ================= DETECT INTENT ================= */
export function detectIntent(
  message: string,
  detectedServices: string[] = [],
  topN: number = 3
): { intent: Intent; score: number }[] {

  const text = normalize(message);

  if (!text) {
    return [
      {
        intent: intents[0],
        score: 0.9,
      },
    ];
  }

  let results: { intent: Intent; score: number }[] = [];

  // base scoring
  for (const intent of intents) {
    const score = calculateScore(text, intent);
    if (score > 0.25) {
      results.push({ intent, score });
    }
  }

  // strong signals
  applyStrongSignals(text, results);

  // clean + prioritize
  let final = cleanResults(results);

  // 🔥 CRITICAL FIX: suppress weak service intents
  const hasStrongNonService = final.some(
    (r) => r.intent.type === "buying" || r.intent.type === "problem"
  );

  if (hasStrongNonService) {
    final = final.filter((r) => r.intent.type !== "service");
  }

  // fallback
  if (final.length === 0) {
    return [
      {
        intent: {
          name: "general",
          category: "general",
          type: "general",
          keywords: [],
          description: "Fallback",
        },
        score: 0.3,
      },
    ];
  }

  return final.slice(0, topN);
}

/* ================= PUBLIC ================= */
export function getRelevantIntents(
  message: string,
  detectedServices: string[] = [],
  limit: number = 3
) {
  return detectIntent(message, detectedServices, limit);
}
