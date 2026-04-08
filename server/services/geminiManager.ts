export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
export const GEMINI_ENABLED = typeof GEMINI_API_KEY === "string" && GEMINI_API_KEY.length > 20;
export const GEMINI_DAILY_LIMIT = 20;

let geminiUsage = { count: 0, lastReset: Date.now() };

export function canUseGemini(): boolean {
  if (!GEMINI_ENABLED) return false;
  const now = Date.now();
  const ONE_DAY = 86400000;

  if (now - geminiUsage.lastReset > ONE_DAY) {
    geminiUsage.count = 0;
    geminiUsage.lastReset = now;
  }

  return geminiUsage.count < GEMINI_DAILY_LIMIT;
}

export function markGeminiUsed() {
  geminiUsage.count++;
}
