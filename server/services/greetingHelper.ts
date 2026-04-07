// server/services/smartGreeting.ts
import { memoryService } from "./memoryService.js";

/**
 * Returns a dynamic greeting if the assistant hasn't spoken yet and context is low.
 * Prevents greeting overrides for service-specific queries.
 */
export async function smartGreeting(brainContext: any, recentMessages: any[]): Promise<string | null> {
  const hasContext = brainContext?.hasSufficientContext || (brainContext?.leadScore ?? 0) > 0.3;
  const hasAssistantSpoken = recentMessages.some((m: any) => m.role === "assistant");

  // Only greet if no assistant reply yet AND low context
  if (hasContext || hasAssistantSpoken) return null;

  // Use dynamic greeting if set in brain context
  if (brainContext?.dynamicGreeting) return brainContext.dynamicGreeting;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return `${greeting} — what are you trying to improve right now?`;
}
