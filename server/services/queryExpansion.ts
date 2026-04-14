// server/services/queryExpansion.ts

export async function expandQueryNeural(
  userMessage: string,
  history: string[] = []
): Promise<string[]> {
  if (typeof userMessage !== "string") return [];

  const normalized = userMessage.trim().toLowerCase();
  if (!normalized) return [];

  const expansions = new Set<string>();
  expansions.add(normalized);

  const words = normalized.split(/\s+/).slice(0, 6);

  if (words.length > 1) {
    const base = words.join(" ");

    expansions.add(`${base} marketing strategy`);
    expansions.add(`${base} service solution`);
    expansions.add(`${base} business growth`);
    expansions.add(`${base} conversion optimization`);
  }

  // safe history injection
  history
    .filter((h) => typeof h === "string" && h.trim().length > 0)
    .slice(-2)
    .forEach((h) => expansions.add(h.toLowerCase().trim()));

  // service expansion rules
  if (normalized.includes("seo") || normalized.includes("position zero")) {
    expansions.add("voice search optimization");
    expansions.add("ai seo strategy");
    expansions.add("featured snippets optimization");
  }

  if (normalized.includes("youtube") || normalized.includes("video ads")) {
    expansions.add("youtube ads optimization");
    expansions.add("video marketing funnel");
  }

  if (normalized.includes("cgi") || normalized.includes("3d")) {
    expansions.add("cgi marketing");
    expansions.add("immersive 3d ads");
    expansions.add("product renders");
  }

  return Array.from(expansions);
}
