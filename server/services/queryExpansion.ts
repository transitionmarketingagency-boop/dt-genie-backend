// server/services/queryExpansion.ts
export async function expandQueryNeural(userMessage: string, history: string[] = []): Promise<string[]> {
  const normalized = userMessage.trim().toLowerCase();
  const expansions = [normalized];

  const words = normalized.split(" ").slice(0, 6);
  if (words.length > 1) {
    const base = words.join(" ");
    expansions.push(`${base} marketing strategy`);
    expansions.push(`${base} service solution`);
    expansions.push(`${base} business growth`);
    expansions.push(`${base} conversion optimization`);
  }

  history.slice(-2).forEach((h) => expansions.push(h.toLowerCase()));

  return Array.from(new Set(expansions));
}
