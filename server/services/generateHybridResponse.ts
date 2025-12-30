import { fetchRelevantChunks } from "../training_pipeline/utils/query-chunks";
import { generateGemma } from "./gemmaClient";
import { memoryClient } from "./memoryClient";
import fs from "fs";
import path from "path";

// ------------------ LOAD SYSTEM PERSONA ------------------
const personaPath = path.join(
  __dirname,
  "../knowledge_base/persona/system_persona.json"
);

const systemPersona = JSON.parse(fs.readFileSync(personaPath, "utf-8"));

// ------------------ HELPER: USER ROLE DETECTION ------------------
function detectUserRole(userMessage: string): string {
  const msg = userMessage.toLowerCase();

  if (msg.includes("buy") || msg.includes("pricing") || msg.includes("client"))
    return "sales";

  if (msg.includes("ad") || msg.includes("campaign") || msg.includes("marketing"))
    return "marketing";

  if (msg.includes("help") || msg.includes("issue") || msg.includes("support"))
    return "support";

  return "general";
}

// ------------------ CONTEXT BUILDER ------------------
async function buildDeepContext(userId: string, userMessage: string) {
  const relevantChunks = await fetchRelevantChunks(userMessage, 5);
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

// ------------------ MAIN GENERATOR ------------------
export async function generateHybridResponse(
  userId: string,
  userMessage: string
): Promise<string> {
  try {
    const context = await buildDeepContext(userId, userMessage);

    const response = await generateGemma(context);

    memoryClient.appendSessionMemory(userId, {
      user: userMessage,
      bot: response,
    });

    memoryClient.appendUserMemory(userId, {
      user: userMessage,
      bot: response,
    });

    return response;
  } catch (error) {
    console.error("Hybrid response error:", error);
    return "Sorry, something went wrong while generating the response.";
  }
}
