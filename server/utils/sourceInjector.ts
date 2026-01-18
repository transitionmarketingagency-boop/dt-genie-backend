export function injectSources(response: string, sources: string[] = []) {
  if (!sources?.length) return response;
  const formattedSources = sources.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return `${response}\n\nReferences:\n${formattedSources}`;
}
