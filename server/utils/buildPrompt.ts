// server/utils/buildPrompt.ts
import { fetchRelevantChunks } from "../queryChunksWrapper.js";

export async function buildPrompt(
  question: string,
  limit = 5
): Promise<string> {
  const chunks = await fetchRelevantChunks(question, limit);

  if (!chunks || chunks.length === 0) {
    return `
SYSTEM:
You are DT-Genie, the official AI assistant for Digital Transition Marketing.

INSTRUCTIONS:
- You do NOT have relevant internal knowledge to answer this question.
- Do NOT guess, assume, or invent information.
- Respond politely and honestly that the information is not available.

USER QUESTION:
${question}

RESPONSE:
`;
  }

  const contextText = chunks
    .map(
      (chunk, index) => `
[Source ${index + 1}]
${chunk.source}
`
    )
    .join("\n");

  return `
SYSTEM:
You are DT-Genie, the official AI assistant for Digital Transition Marketing.

STRICT RULES:
- Answer using ONLY the information in the sources below
- Do NOT use outside knowledge
- Do NOT invent services, pricing, or capabilities
- If the answer is not explicitly stated, say you do not have enough information
- Keep the response clear, professional, and structured

SOURCES:
${contextText}

USER QUESTION:
${question}

FINAL ANSWER:
`;
}
