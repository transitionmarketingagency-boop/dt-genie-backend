// server/services/smartGreeting.ts

/**
 * Lightweight greeting — only triggers for very short messages
 * and never overrides meaningful queries.
 */
export async function smartGreeting(
  brainContext: any,
  recentMessages: any[]
): Promise<string | null> {

  const message = brainContext?.message?.toLowerCase?.() || "";

  // ✅ ONLY trigger on pure greetings
  const isGreeting = /^(hi|hello|hey|yo|whats up|what's up)$/.test(message);

  if (!isGreeting) return null;

  // ❌ DO NOT depend on recentMessages (unstable)
  // ❌ DO NOT depend on leadScore (can be noisy)

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning"
    : hour < 18 ? "Good afternoon"
    : "Good evening";

  return `${greeting} — what are you trying to improve right now?`;
}
