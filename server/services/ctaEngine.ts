/**
 * ==========================================
 * CTA ENGINE (PHASE 6 — FIXED PRODUCTION v2)
 * ==========================================
 */

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
  return /(not now|later|no thanks|dont want|don't want|just exploring|not interested|maybe later|busy|i will book later|stop|leave me)/i.test(
    message
  );
}

/* ================= WEAK MESSAGE ================= */
function isWeakMessage(message: string): boolean {
  const msg = normalize(message);

  if (!msg) return true;
  if (msg.length < 4) return true;

  if (/^(hi|hello|hey|yo|ok|yes|no|hmm|thanks)$/i.test(msg)) return true;

  return false;
}

/* ================= SERVICE PRIORITY ================= */
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

  return "general";
}

/* ================= CTA TEMPLATES ================= */

const CTA_TEMPLATES = {
  general: {
    soft: "If it makes sense, I can map a clear strategy for your setup.",
    strong:
      "We can structure a clear plan for this — want me to map it properly?",
  },

  ai_automation: {
    soft: "I can outline a simple automation flow for your business.",
    strong: "We can design an automation system for this — want the structure?",
  },

  performance_marketing: {
    soft: "I can show how to improve your ad performance step by step.",
    strong: "We can fix your ad system structure — want the breakdown?",
  },

  ai_search_domination_geo: {
    soft: "I can show how to improve your AI search visibility.",
    strong: "We can position you in AI search results — want the method?",
  },

  cgi_tours: {
    soft: "I can show how CGI improves conversion rates.",
    strong: "We can design CGI assets for higher conversion — want the plan?",
  },
};

/* ================= SHOULD SHOW CTA ================= */
function shouldShowCTA(input: CTAInput): boolean {
  const { message, stage, leadScore } = input;

  const msg = normalize(message);

  /* HARD BLOCKS */
  if (detectRejection(msg)) return false;
  if (isWeakMessage(msg)) return false;
  if (stage === "greeting") return false;

  /* REMOVE OVER-AGGRESSIVE STAGE TRIGGERS */
  const stageAllowed = stage === "service" || stage === "conversion";

  /* INTENT DETECTION */
  const strongIntent =
    /(hire|start|book|schedule|call|work with you|get started|pricing|cost)/i.test(
      msg
    );

  /* INFORMATIONAL CONTROL (FIXED) */
  const isInformational =
    /(what|why|how|explain|tell me|guide|learn|help)/i.test(msg);

  // FIX: only block informational when LOW intent
  if (isInformational && leadScore < 0.7 && !strongIntent) return false;

  /* STRONG INTENT ALWAYS TRUE */
  if (strongIntent) return true;

  /* SCORE GATE (TIGHTER) */
  if (leadScore >= 0.75) return true;

  /* STAGE GATE (NOW SAFE) */
  if (stageAllowed && leadScore >= 0.6) return true;

  return false;
}

/* ================= INTENSITY ================= */
function getCTAIntensity(input: CTAInput): "soft" | "strong" {
  const { leadScore, stage, executionMode } = input;

  if (executionMode === "execution") return "strong";
  if (leadScore >= 0.85) return "strong";
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

    const cta = templates[intensity] || "";

    // SAFETY: ensure no booking hallucination language leaks
    if (
      /(booked|scheduled|calendar|confirmed|email sent)/i.test(cta)
    ) {
      return "";
    }

    return `\n\n${cta}`;
  } catch {
    return "";
  }
}
