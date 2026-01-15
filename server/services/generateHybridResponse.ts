import { fetchRelevantChunks } from "../query-chunks.js";
import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js"; // ✅ fallback
import { memoryClient } from "./memoryClient.js";
import { getPromptEmbedding, enforceBotName } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js"; // ✅ fixed path
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
  const embedding = await getPromptEmbedding(userMessage); // ✅ compute embedding once
  const relevantChunks = await fetchRelevantChunks(userMessage, 5); // ✅ top chunks

  const sessionMemory = memoryClient.getSessionMemory(userId);
  const userMemory = memoryClient.getUserMemory(userId);
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

    // ------------------ ENFORCE BOT NAME ------------------
    response = enforceBotName(response, userMessage);

    // ------------------ MEMORY PERSISTENCE ------------------
    memoryClient.appendSessionMemory(userId, { user: userMessage, bot: response });
    memoryClient.appendUserMemory(userId, { user: userMessage, bot: response });

    return response;
  } catch (error) {
    console.error("Hybrid response error:", error);
    return "Sorry, something went wrong while generating the response.";
  }
}
