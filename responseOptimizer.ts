/**
 * ==========================================
 * RESPONSE OPTIMIZER (PHASE 2 CORE LAYER)
 * ==========================================
 *
 * Purpose:
 * - Score AI response quality
 * - Detect weak / generic / repetitive outputs
 * - Repair structure + completeness
 * - Upgrade response into "consultant-grade output"
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
    score -= 0.4;
    issues.push("too_short");
  }

  /* ===== GENERIC PATTERNS ===== */
  const genericPatterns = [
    "it depends",
    "here are some tips",
    "you should consider",
    "generally speaking",
    "in conclusion",
    "hope this helps",
  ];

  if (genericPatterns.some((p) => lower.includes(p))) {
    score -= 0.25;
    issues.push("generic_language");
  }

  /* ===== REPETITION CHECK ===== */
  const words = text.split(/\s+/);
  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));

  if (words.length > 0 && uniqueWords.size / words.length < 0.6) {
    score -= 0.2;
    issues.push("repetition");
  }

  /* ===== STRUCTURE CHECK ===== */
  const hasSteps =
    /step\s*\d|first|second|then|finally|1\.|2\.|3\./i.test(text);

  if (!hasSteps) {
    score -= 0.15;
    issues.push("no_structure");
  }

  /* ===== ACTIONABILITY CHECK ===== */
  const actionWords = [
    "implement",
    "run",
    "create",
    "launch",
    "build",
    "test",
    "optimize",
  ];

  if (!actionWords.some((w) => lower.includes(w))) {
    score -= 0.15;
    issues.push("low_actionability");
  }

  return {
    score: Math.max(0, Math.min(1, score)),
    isWeak: score < 0.6,
    issues,
  };
}

/* ===================== REPAIR ENGINE ===================== */
export function optimizeResponse(text: string): string {
  if (!text || typeof text !== "string") return "";

  let output = text.trim();

  /* ===== FIX INCOMPLETE SENTENCES ===== */
  if (!/[.!?]$/.test(output)) {
    output += ".";
  }

  /* ===== FORCE STRUCTURE IF MISSING ===== */
  const hasStructure =
    /step|1\.|2\.|3\./i.test(output);

  if (!hasStructure && output.length > 200) {
    output =
      "Here’s a structured breakdown:\n\n" +
      "1. Identify the core issue\n" +
      "2. Implement targeted solution\n" +
      "3. Measure and optimize\n\n" +
      output;
  }

  /* ===== REMOVE WEAK ENDINGS ===== */
  output = output.replace(
    /(hope this helps|let me know if you need anything).*$/i,
    ""
  );

  /* ===== REMOVE REPETITIVE CLOSING PHRASES ===== */
  output = output.replace(
    /(in conclusion|to summarize|overall),?\s*/gi,
    ""
  );

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
