/* =====================================================
   CTA ENGINE (PHASE 6 — PRODUCTION STABLE)
===================================================== */

type Stage =
  | "greeting"
  | "discovery"
  | "strategy"
  | "service"
  | "conversion";

type ExecutionMode = "execution" | "exploration";

interface CTAInput {
  message: string;
  stage: Stage;
  leadScore: number;
  detectedServices?: string[];
  executionMode?: ExecutionMode;
}

/* ================= NORMALIZE ================= */
function normalize(text: string): string {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/* ================= REJECTION ================= */
function detectRejection(message: string): boolean {
  return /(not now|later|no thanks|dont want|don't want|just exploring|not interested|maybe later)/i.test(
    message
  );
}

/* ================= LOW VALUE ================= */
function isWeakMessage(message: string): boolean {
  const msg = normalize(message);

  if (!msg) return true;

  if (msg.length < 4) return true;

  if (/^(hi|hello|hey|yo|ok|yes|no)$/i.test(msg)) return true;

  return false;
}

/* ================= PRIMARY SERVICE ================= */
function detectPrimaryService(services: string[] = []): string {
  if (!services.length) return "general";

  const priority = [
    "performance_marketing",
    "ai_automation",
    "ai_search_domination_geo",
    "cgi_tours",
  ];

  for (const p of priority) {
    if (services.includes(p)) return p;
  }

  return services[0] || "general";
}

/* ================= CTA TEMPLATES ================= */

const CTA_TEMPLATES = {
  general: {
    soft: "If you want, I can map this into a clear plan for your business.",
    strong: "We can turn this into a working system for you — want me to outline the next steps?",
  },

  ai_automation: {
    soft: "I can map a simple automation flow based on your setup if you want.",
    strong: "We can build this automation system for you — want me to break down how it would work?",
  },

  performance_marketing: {
    soft: "I can outline how your ads should be structured for better results.",
    strong: "We can restructure your campaigns and improve performance — want a clear plan?",
  },

  ai_search_domination_geo: {
    soft: "I can show how your business can start appearing in AI search results.",
    strong: "We can position your business to rank inside AI systems — want the exact approach?",
  },

  cgi_tours: {
    soft: "I can show how CGI visuals would improve your marketing.",
    strong: "We can build high-conversion visuals for you — want to see the approach?",
  },
};

/* ================= SHOULD SHOW CTA ================= */

function shouldShowCTA(input: CTAInput): boolean {
  const { message, stage, leadScore } = input;

  const msg = normalize(message);

  /* ---------- HARD BLOCK ---------- */
  if (detectRejection(msg)) return false;

  if (isWeakMessage(msg)) return false;

  if (stage === "greeting") return false;

  /* ---------- INFORMATIONAL CONTROL ---------- */
  const isInformational =
    /(what|why|how|explain|tell me|guide|learn)/i.test(msg);

  if (isInformational && leadScore < 0.6) return false;

  /* ---------- STRONG INTENT ---------- */
  if (
    /(hire|start|book|schedule|call|work with you|get started)/i.test(msg)
  ) {
    return true;
  }

  /* ---------- STAGE + SCORE ---------- */
  if (leadScore >= 0.6) return true;

  if (stage === "service" || stage === "conversion") return true;

  return false;
}

/* ================= INTENSITY ================= */

function getCTAIntensity(input: CTAInput): "soft" | "strong" {
  const { leadScore, stage, executionMode } = input;

  if (executionMode === "execution") return "strong";

  if (leadScore >= 0.75) return "strong";

  if (stage === "conversion") return "strong";

  return "soft";
}

/* ================= MAIN ================= */

export function generateCTA(input: CTAInput): string {
  try {
    if (!shouldShowCTA(input)) return "";

    const service = detectPrimaryService(input.detectedServices);

    const intensity = getCTAIntensity(input);

    const templates =
      CTA_TEMPLATES[service as keyof typeof CTA_TEMPLATES] ||
      CTA_TEMPLATES.general;

    const cta = templates[intensity];

    if (!cta) return "";

    return `\n\n${cta}`;
  } catch {
    return "";
  }
}
