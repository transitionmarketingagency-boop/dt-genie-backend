/**
 * ==========================================
 * CTA ENGINE (PHASE 6 — FINAL STABLE)
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
  return /(not now|later|no thanks|dont want|don't want|just exploring|not interested|maybe later|busy|stop)/i.test(
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

/* ================= HIGH INTENT DETECTION (FIXED) ================= */
function isHighIntent(message: string): boolean {
  const msg = normalize(message);

  return /(hire|start|book|schedule|call|work with you|get started|we need help|can you handle|can we start|ready to move|lets begin)/i.test(
    msg
  );
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

/* ================= CTA TEMPLATES (UPGRADED) ================= */

const CTA_TEMPLATES = {
  general: {
    soft: "If you want, I can map a clear next step based on your setup.",
    strong: "We can move forward with this — want me to map the exact next steps?",
  },

  ai_automation: {
    soft: "I can outline a simple automation setup for your workflow.",
    strong: "We can build this system for you — want me to break down the rollout?",
  },

  performance_marketing: {
    soft: "I can show you exactly where your ads are leaking performance.",
    strong: "We can fix your ad system end-to-end — want the exact plan?",
  },

  ai_search_domination_geo: {
    soft: "I can show how to improve your visibility in AI search.",
    strong: "We can position your brand in AI search results — want the execution plan?",
  },

  cgi_tours: {
    soft: "I can show how this improves conversion for listings.",
    strong: "We can build high-conversion visuals for your properties — want the breakdown?",
  },
};

/* ================= SHOULD SHOW CTA (STRICT CONTROL) ================= */
function shouldShowCTA(input: CTAInput): boolean {
  const { message, stage, leadScore, executionMode } = input;

  const msg = normalize(message);

  /* HARD BLOCKS */
  if (detectRejection(msg)) return false;
  if (isWeakMessage(msg)) return false;
  if (stage === "greeting") return false;

  /* HIGH INTENT → ALWAYS ALLOW */
  if (isHighIntent(msg)) return true;

  /* EXECUTION MODE PRIORITY */
  if (executionMode === "execution" && leadScore >= 0.65) return true;

  /* INFORMATIONAL FILTER (STRICT) */
  const isInformational =
    /(what|why|how|explain|tell me|guide|learn)/i.test(msg);

  if (isInformational && leadScore < 0.75) return false;

  /* MID STAGE CONTROL */
  if (stage === "service" && leadScore >= 0.7) return true;

  if (stage === "conversion") return true;

  return false;
}

/* ================= INTENSITY ================= */
function getCTAIntensity(input: CTAInput): "soft" | "strong" {
  const { leadScore, stage, executionMode, message } = input;

  if (isHighIntent(message)) return "strong";

  if (executionMode === "execution") return "strong";

  if (leadScore >= 0.8) return "strong";

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
