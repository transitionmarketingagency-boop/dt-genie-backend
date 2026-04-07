// server/services/queryExpansion.ts
/**
 * Expands a user message for semantic search / vector queries.
 * Adds service-specific keywords and recent conversation history.
 * Enhanced to preserve intent specificity and prevent dilution.
 */
export async function expandQueryNeural(
  userMessage: string,
  history: string[] = []
): Promise<string[]> {
  const normalized = userMessage.trim().toLowerCase();
  const expansions = [normalized];

  // Use first 6 words as base for expansions
  const words = normalized.split(" ").slice(0, 6);
  if (words.length > 1) {
    const base = words.join(" ");
    expansions.push(`${base} marketing strategy`);
    expansions.push(`${base} service solution`);
    expansions.push(`${base} business growth`);
    expansions.push(`${base} conversion optimization`);
  }

  // Include last 2 user messages for context-aware expansion
  history.slice(-2).forEach((h) => expansions.push(h.toLowerCase()));

  // Service-specific triggers
  if (normalized.includes("seo") || normalized.includes("position zero")) {
    expansions.push("voice search optimization", "ai seo strategy", "featured snippets");
  }
  if (normalized.includes("youtube") || normalized.includes("video ads")) {
    expansions.push("youtube ads optimization", "video marketing funnel");
  }
  if (normalized.includes("cgi") || normalized.includes("3d")) {
    expansions.push("cgi marketing", "immersive 3d ads", "product renders");
  }

  return Array.from(new Set(expansions)); // Remove duplicates
}
