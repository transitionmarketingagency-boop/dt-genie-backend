import { memoryService } from "./memoryService.js";

export async function smartGreeting(brainContext: any, recentMessages: any[]): Promise<string | null> {
  const hasContext = brainContext?.hasSufficientContext || (brainContext?.leadScore ?? 0) > 0.3;
  const hasAssistantSpoken = recentMessages.some((m: any) => m.role === "assistant");

  if (hasContext || hasAssistantSpoken) return null;

  if (brainContext?.dynamicGreeting) return brainContext.dynamicGreeting;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return `${greeting} — what are you trying to improve right now?`;
}
