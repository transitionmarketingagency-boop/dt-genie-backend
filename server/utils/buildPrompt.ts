// server/utils/buildPrompt.ts
import { fetchRelevantChunks } from "../queryChunksWrapper.js";

export async function buildPrompt(
  question: string,
  limit = 5
): Promise<string> {
  const chunks = await fetchRelevantChunks(question, limit);

  // Safety: no context found
  if (!chunks || chunks.length === 0) {
    return `
SYSTEM:
You are DT-Genie, the official AI assistant for Digital Transition Marketing.

USER QUESTION:
"${question}"

INSTRUCTION:
No relevant information was found in the knowledge base.
Politely say you do not have enough information to answer.
`;
  }

  const contextText = chunks
    .map(
      (chunk, index) => `
[Context ${index + 1}]
${chunk.content}
`
    )
    .join("\n");

  return `
SYSTEM:
You are DT-Genie, the official AI assistant for Digital Transition Marketing.

RULES:
- Answer using ONLY the context below
- Do NOT use outside knowledge
- Be clear, professional, and confident
- If the answer is not in the context, say you do not have enough information

====================
CONTEXT:
${contextText}
====================

USER QUESTION:
${question}

ANSWER AS DT-GENIE:
`;
}
