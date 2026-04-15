/* =====================================================
   CTA ENGINE (PHASE 5.5 — CONVERSION INTELLIGENCE)
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

/* ================= HELPERS ================= */

function normalize(text: string): string {
  return (text || "").toLowerCase().trim();
}

function isWeakMessage(message: string): boolean {
  return /^(hi|hello|hey|yo|ok|yes|no)$/i.test(message);
}

function detectPrimaryService(services: string[] = []): string {
  if (!services.length) return "general";

  // prioritize high-value services
  const priority = [
    "ai_automation",
    "performance_marketing",
    "ai_search_domination_geo",
    "cgi_tours",
  ];

  for (const p of priority) {
    if (services.includes(p)) return p;
  }

  return services[0];
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
    soft: "I can show how CGI tours would fit into your property marketing.",
    strong: "We can build high-conversion CGI visuals for your projects — want to see the approach?",
  },
};

/* ================= STAGE LOGIC ================= */

function shouldShowCTA(input: CTAInput): boolean {
  const { message, stage, leadScore } = input;

  if (isWeakMessage(message)) return false;

  if (stage === "greeting") return false;

  if (leadScore >= 0.5) return true;

  if (stage === "service" || stage === "conversion") return true;

  return false;
}

function getCTAIntensity(input: CTAInput): "soft" | "strong" {
  const { leadScore, stage, executionMode } = input;

  if (executionMode === "execution") return "strong";

  if (leadScore >= 0.75) return "strong";

  if (stage === "conversion") return "strong";

  return "soft";
}

/* ================= MAIN ENGINE ================= */

export function generateCTA(input: CTAInput): string {
  try {
    const { message, detectedServices = [] } = input;

    if (!shouldShowCTA(input)) return "";

    const service = detectPrimaryService(detectedServices);

    const intensity = getCTAIntensity(input);

    const serviceTemplates =
      CTA_TEMPLATES[service as keyof typeof CTA_TEMPLATES] ||
      CTA_TEMPLATES.general;

    const cta = serviceTemplates[intensity];

    if (!cta) return "";

    return `\n\n${cta}`;
  } catch {
    return "";
  }
}
