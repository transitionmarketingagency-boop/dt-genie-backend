import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { detectRole, getRoleRules } from "./roleRouter.js";

/**
 * Keywords that indicate complex/high-reasoning prompts
 */
const COMPLEX_KEYWORDS = [
  "strategy",
  "plan",
  "analyze",
  "analysis",
  "funnel",
  "campaign",
  "roadmap",
  "growth",
  "automation",
  "architecture",
  "system",
];

/**
 * Determine if a prompt is complex enough to require Gemini
 */
function isComplex(prompt: string): boolean {
  if (prompt.length > 300) return true;
  const lower = prompt.toLowerCase();
  return COMPLEX_KEYWORDS.some(word => lower.includes(word));
}

/**
 * Hybrid response generator with role + persona awareness
 * - Simple prompts → Gemma (local)
 * - Complex prompts → Gemini (cloud)
 * - Persona + Role rules applied in prompt
 */
export async function generateHybridResponse(userInput: string, chatHistory: string[] = []): Promise<string> {
  // 1️⃣ Detect user role
  const role = detectRole(userInput);
  const roleRules = getRoleRules(role);

  // 2️⃣ Build persona-aware prompt
  const personaPrompt = `
You are Digital Transition Marketing's internal AI assistant.
Role: ${role.toUpperCase()}
Rules: ${JSON.stringify(roleRules)}
General Rules: Always use DTM brand tone, never hallucinate, focus on actionable recommendations.

Chat History:
${chatHistory.join("\n")}

User: ${userInput}
Response:
`;

  // 3️⃣ Choose model based on complexity
  try {
    if (!isComplex(userInput)) {
      const gemmaResponse = await generateGemma(personaPrompt);
      if (gemmaResponse && gemmaResponse.trim().length > 20) {
        return gemmaResponse;
      }
    }
  } catch (err) {
    console.warn("⚠️ Gemma failed, falling back to Gemini:", err);
  }

  return generateGemini(personaPrompt);
}
