// server/services/generateHybridResponse.ts

import { fetchRelevantChunks } from "../queryChunksWrapper.js";
import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { getPromptEmbedding, enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/* ---------------- ESM-safe __dirname ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- Load persona ---------------- */
const personaPath = path.join(
  __dirname,
  "../knowledge_base/persona/system_persona.json"
);
const systemPersona = JSON.parse(fs.readFileSync(personaPath, "utf-8"));

/* ---------------- Role detection ---------------- */
function detectUserRole(msg: string): string {
  const t = msg.toLowerCase();
  if (t.includes("price") || t.includes("buy") || t.includes("call")) return "sales";
  if (t.includes("campaign") || t.includes("marketing")) return "marketing";
  if (t.includes("issue") || t.includes("help")) return "support";
  return "general";
}

/* ---------------- Format memory ---------------- */
function formatMemory(history: any[]) {
  if (!history.length) return "No prior conversation.";
  return history
    .slice(-10)
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
}

/* ---------------- Context builder ---------------- */
async function buildDeepContext(userId: string, userMessage: string) {
  const relevantChunks = await fetchRelevantChunks(userMessage, 5);
  const history = await memoryService.getHistory(userId);
  const role = detectUserRole(userMessage);

  return `
SYSTEM PERSONA:
${JSON.stringify(systemPersona)}

USER ROLE:
${role}

CONVERSATION HISTORY:
${formatMemory(history)}

RELEVANT KNOWLEDGE:
${JSON.stringify(relevantChunks)}

USER MESSAGE:
${userMessage}
`;
}

/* ---------------- Main hybrid response ---------------- */
export async function generateHybridResponse(
  userMessage: string,
  userId = "default-session"
): Promise<string> {
  try {
    await memoryService.addMessage(userId, "user", userMessage);

    const context = await buildDeepContext(userId, userMessage);

    let response = await generateGemma(context);
    response = cleanResponse(response || "");

    if (!response) {
      response = await generateGemini(context);
      response = cleanResponse(response || "");
    }

    response = enforceBotName(response, userMessage);

    if (/book|schedule|call|meeting/i.test(userMessage)) {
      response +=
        "\n\n📅 Book a call here:\nhttps://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future";
    }

    await memoryService.addMessage(userId, "assistant", response);
    return response;

  } catch (err) {
    console.error("Hybrid response error:", err);
    return `Sorry — ${BOT_NAME} is temporarily unavailable.`;
  }
}
