/**
 * Improved greeting — triggers on greetings with optional text,
 * avoids repeating same greeting in session, and combines with recent messages.
 */
export async function smartGreeting(
  brainContext: any,
  recentMessages: string[] = []
): Promise<string | null> {
  const message = brainContext?.message?.toLowerCase?.() || "";

  // ✅ Trigger on greetings + optional extra text
  const isGreeting = /^(hi|hello|hey|yo|good morning|good afternoon|good evening)[\s,!]?.*/i.test(message);
  if (!isGreeting) return null;

  // ✅ Avoid repeating same greeting if recently used
  const lastGreeting = recentMessages?.slice(-3).find((m) =>
    /hi|hello|hey|yo|good morning|good afternoon|good evening/i.test(m)
  );
  if (lastGreeting) return null;

  // ✅ Time-based greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning"
    : hour < 18 ? "Good afternoon"
    : "Good evening";

  return `${greeting} — what’s the main improvement you’re looking for today?`;
}
