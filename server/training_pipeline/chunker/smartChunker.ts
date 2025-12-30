import { chunkRules } from "./chunkRules.js";
import { detectIntent } from "../utils/intentDetector.js";

export function smartChunk(
  text: string,
  type: keyof typeof chunkRules,
  source: string
) {
  const rule = chunkRules[type];
  const words = text.split(" ");
  const chunks: any[] = [];

  let i = 0;
  while (i < words.length) {
    const slice = words.slice(i, i + rule.maxTokens).join(" ");
    chunks.push({
      content: slice.trim(),
      metadata: {
        type,
        source,
        intent: detectIntent(slice),
        purpose: rule.purpose
      }
    });
    i += rule.maxTokens - rule.overlap;
  }

  return chunks;
}
