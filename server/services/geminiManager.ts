export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export const GEMINI_ENABLED =
  typeof GEMINI_API_KEY === "string" && GEMINI_API_KEY.length > 20;

export const GEMINI_DAILY_LIMIT = 20;

let geminiUsage = {
  count: 0,
  lastReset: Date.now(),
};

export function canUseGemini(): boolean {
  if (!GEMINI_ENABLED) return false;

  const ONE_DAY = 86400000;
  const now = Date.now();

  if (now - geminiUsage.lastReset > ONE_DAY) {
    geminiUsage.count = 0;
    geminiUsage.lastReset = now;
  }

  return geminiUsage.count < GEMINI_DAILY_LIMIT;
}

export function markGeminiUsed(): void {
  if (!geminiUsage) {
    geminiUsage = { count: 0, lastReset: Date.now() };
  }

  geminiUsage.count = Math.max(0, geminiUsage.count + 1);
}
