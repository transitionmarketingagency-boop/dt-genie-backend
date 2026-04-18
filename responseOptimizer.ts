/**
 * ==========================================
 * RESPONSE OPTIMIZER (PHASE 2 CORE LAYER - FIXED)
 * ==========================================
 */

export type ResponseQuality = {
  score: number;
  isWeak: boolean;
  issues: string[];
};

/* ===================== SCORING ===================== */
export function scoreResponse(text: string): ResponseQuality {
  if (!text || typeof text !== "string") {
    return { score: 0, isWeak: true, issues: ["empty"] };
  }

  const issues: string[] = [];
  let score = 1;

  const lower = text.toLowerCase();

  /* ===== LENGTH CHECK ===== */
  if (text.length < 120) {
    score -= 0.35;
    issues.push("too_short");
  }

  /* ===== GENERIC LOOP DETECTION (CRITICAL FIX) ===== */
  const loopPatterns = [
    "based on your situation",
    "here’s what matters most",
    "this is the core idea",
    "execution is what drives results",
  ];

  if (loopPatterns.some((p) => lower.includes(p))) {
    score -= 0.5;
    issues.push("fallback_loop_detected");
  }

  /* ===== GENERIC LANGUAGE ===== */
  const genericPatterns = [
    "it depends",
    "here are some tips",
    "you should consider",
    "generally speaking",
    "in conclusion",
    "hope this helps",
  ];

  if (genericPatterns.some((p) => lower.includes(p))) {
    score -= 0.2;
    issues.push("generic_language");
  }

  /* ===== REPETITION CHECK ===== */
  const words = text.split(/\s+/);
  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));

  if (words.length > 0 && uniqueWords.size / words.length < 0.6) {
    score -= 0.2;
    issues.push("repetition");
  }

  /* ===== STRUCTURE IS OPTIONAL (FIXED) ===== */
  const hasStructure =
    /step\s*\d|first|second|then|finally|1\.|2\.|3\./i.test(text);

  if (!hasStructure && text.length > 500) {
    score -= 0.1;
    issues.push("missing_structure_long_answer");
  }

  /* ===== ACTIONABILITY (FIXED - SOFT SIGNAL ONLY) ===== */
  const actionWords = [
    "implement",
    "run",
    "create",
    "launch",
    "build",
    "test",
    "optimize",
    "fix",
  ];

  if (!actionWords.some((w) => lower.includes(w))) {
    score -= 0.05;
    issues.push("low_actionability");
  }

  return {
    score: Math.max(0, Math.min(1, score)),
    isWeak: score < 0.65,
    issues,
  };
}

/* ===================== REPAIR ENGINE ===================== */
export function optimizeResponse(text: string): string {
  if (!text || typeof text !== "string") return "";

  let output = text.trim();

  /* ===== REMOVE LOOP PHRASES ===== */
  output = output.replace(
    /(based on your situation|this is the core idea|execution is what drives results)[^.!?]*\.?/gi,
    ""
  );

  /* ===== REMOVE WEAK CLOSINGS ===== */
  output = output.replace(
    /(hope this helps|let me know if you need anything).*$/i,
    ""
  );

  /* ===== REMOVE GENERIC SUMMARIES ===== */
  output = output.replace(
    /(in conclusion|to summarize|overall),?\s*/gi,
    ""
  );

  /* ===== FIX INCOMPLETE SENTENCE ===== */
  if (!/[.!?]$/.test(output)) {
    output += ".";
  }

  /* ===== NORMALIZE SPACING ===== */
  output = output
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  return output;
}

/* ===================== MAIN PIPELINE ===================== */
export function processResponse(text: string): {
  optimized: string;
  quality: ResponseQuality;
} {
  const quality = scoreResponse(text);

  let optimized = text;

  if (quality.isWeak) {
    optimized = optimizeResponse(text);
  }

  return {
    optimized,
    quality,
  };
}
