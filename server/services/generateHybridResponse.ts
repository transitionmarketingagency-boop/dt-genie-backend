// server/services/generateHybridResponse.ts

import { fetchRelevantChunks } from "../queryChunksWrapper.js";
import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js"; // fallback
import { memoryService } from "./memoryService.js"; // <-- FIXED
import { getPromptEmbedding, enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ------------------ ESM __dirname FIX ------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------ LOAD SYSTEM PERSONA ------------------
const personaPath = path.join(
  __dirname,
  "../knowledge_base/persona/system_persona.json"
);
const systemPersona = JSON.parse(fs.readFileSync(personaPath, "utf-8"));

// ------------------ ROLE DETECTION ------------------
function detectUserRole(userMessage: string): string {
  const msg = userMessage.toLowerCase();
  if (msg.includes("buy") || msg.includes("pricing") || msg.includes("client")) return "sales";
  if (msg.includes("ad") || msg.includes("campaign") || msg.includes("marketing")) return "marketing";
  if (msg.includes("help") || msg.includes("issue") || msg.includes("support")) return "support";
  return "general";
}

// ------------------ CONTEXT BUILDER ------------------
async function buildDeepContext(userId: string, userMessage: string) {
  const embedding = await getPromptEmbedding(userMessage);
  const relevantChunks = await fetchRelevantChunks(userMessage, 5);

  // FIXED: Use memoryService instead of memoryClient
  const sessionMemory = await memoryService.getHistory(userId);
  const userMemory = await memoryService.getHistory(userId);
  const role = detectUserRole(userMessage);

  return `
System Persona:
${JSON.stringify(systemPersona)}

Role:
${role}

Session Memory:
${JSON.stringify(sessionMemory)}

User Memory:
${JSON.stringify(userMemory)}

Relevant Knowledge:
${JSON.stringify(relevantChunks)}

User Message:
${userMessage}
`;
}

// ------------------ HYBRID RESPONSE ------------------
export async function generateHybridResponse(
  userMessage: string,
  userId = "default-session"
): Promise<string> {
  try {
    const context = await buildDeepContext(userId, userMessage);

    // ------------------ GEMMA FIRST ------------------
    let response = await generateGemma(context);

    // ------------------ CLEAN RESPONSE ------------------
    response = cleanResponse(response || "");

    // ------------------ GEMINI FALLBACK ------------------
    if (!response || response.trim() === "") {
      console.warn("Gemma failed, trying Gemini fallback...");
      response = await generateGemini(context);
      response = cleanResponse(response || "");
    }

    // ------------------ ENFORCE BOT NAME & BRAND ------------------
    response = enforceBotName(response, userMessage);

    // ------------------ CALENDLY LINK INJECTION ------------------
    if (/book.*call/i.test(userMessage)) {
      response += "\n\nSchedule a call here: https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future";
    }

    // ------------------ MEMORY PERSISTENCE ------------------
    await memoryService.addMessage(userId, 'user', userMessage);
    await memoryService.addMessage(userId, 'assistant', response);

    // ------------------ LOG SUCCESS ------------------
    console.log("Hybrid response generated for session:", userId);

    return response;
  } catch (error) {
    console.error("Hybrid response error:", error);
    return `Sorry, ${BOT_NAME} could not generate a response at this time.`;
  }
}
