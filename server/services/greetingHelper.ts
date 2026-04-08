// server/services/greetingHelper.ts

/**
 * Fully controlled greeting system
 * - Triggers ONLY on first message OR pure greeting
 * - Never overrides real intent
 * - Never repeats
 */

export async function smartGreeting(
  message: string,
  recentMessages: string[] = []
): Promise<string | null> {
  if (!message || typeof message !== "string") return null;

  const msg = message.trim().toLowerCase();

  /* ================= STRICT GREETING MATCH ================= */
  const pureGreetings = [
    "hi",
    "hello",
    "hey",
    "yo",
    "good morning",
    "good afternoon",
    "good evening",
  ];

  const isPureGreeting = pureGreetings.includes(msg);

  /* ================= CHECK IF FIRST MESSAGE ================= */
  const isFirstMessage = !recentMessages || recentMessages.length === 0;

  /* ================= PREVENT REPEAT GREETING ================= */
  const alreadyGreeted = recentMessages?.some((m) =>
    /good morning|good afternoon|good evening/i.test(m)
  );

  if (alreadyGreeted) return null;

  /* ================= BLOCK MIXED INTENT ================= */
  const hasBusinessIntent =
    msg.length > 15 || // long message = likely intent
    /(help|ads|marketing|seo|website|automation|sales|leads|problem)/i.test(msg);

  if (hasBusinessIntent) return null;

  /* ================= FINAL TRIGGER ================= */
  if (!(isPureGreeting || isFirstMessage)) return null;

  /* ================= TIME-BASED GREETING ================= */
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? "Good morning"
      : hour < 18
      ? "Good afternoon"
      : "Good evening";

  return `${greeting} — what are you trying to improve right now?`;
}
