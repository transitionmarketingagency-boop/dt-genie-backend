// server/services/generateHybridResponse.ts

import { fetchRelevantChunks } from "../queryChunksWrapper.js";
import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/* ---------------- ESM-safe __dirname ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- Safe persona loader (RENDER SAFE) ---------------- */
const personaPath = path.join(
  __dirname,
  "../knowledge_base/persona/system_persona.json"
);

let systemPersona: any = {
  name: BOT_NAME,
  tone: "professional, helpful, concise",
  rules: [
    "Be accurate",
    "Be honest",
    "Never hallucinate",
    "Help the user achieve their goal"
  ]
};

try {
  if (fs.existsSync(personaPath)) {
    systemPersona = JSON.parse(fs.readFileSync(personaPath, "utf-8"));
  } else {
    console.warn("⚠️ Persona file not found, using fallback persona");
  }
} catch (err) {
  console.warn("⚠️ Failed to load persona, using fallback:", err);
}

/* ---------------- Role detection ---------------- */
function detectUserRole(msg: string): string {
  const t = msg.toLowerCase();
  if (t.includes("price") || t.includes("buy") || t.includes("call")) return "sales";
  if (t.includes("campaign") || t.includes("marketing")) return "marketing";
  if (t.includes("issue") || t.includes("help")) return "support";
  return "general";
}

/* ---------------- Memory formatter (compressed) ---------------- */
function formatMemory(history: any[]) {
  if (!history?.length) return "No prior conversation.";

  return history
    .slice(-8)
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
}

/* ---------------- Persona instruction builder ---------------- */
function buildPersonaInstructions(persona: any) {
  return `
You are ${persona.name || BOT_NAME}.
Tone: ${persona.tone || "professional"}.
Rules:
${(persona.rules || []).map((r: string) => `- ${r}`).join("\n")}
`;
}

/* ---------------- Context builder ---------------- */
async function buildDeepContext(userId: string, userMessage: string) {
  const relevantChunks = await fetchRelevantChunks(userMessage, 5);
  const history = await memoryService.getHistory(userId);
  const role = detectUserRole(userMessage);

  return `
${buildPersonaInstructions(systemPersona)}

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

/* ---------------- Confidence heuristic ---------------- */
function isLowConfidenceResponse(text: string) {
  if (!text) return true;
  if (text.length < 40) return true;
  if (/i am not sure|cannot help|no information/i.test(text)) return true;
  return false;
}

/* ---------------- CTA injector ---------------- */
function injectSmartCTA(response: string, role: string, userMessage: string) {
  if (/book|schedule|call|meeting/i.test(userMessage)) {
    return (
      response +
      "\n\n📅 Book a call here:\nhttps://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future"
    );
  }

  if (role === "marketing") {
    return response + "\n\nWould you like a quick campaign strategy or funnel plan?";
  }

  if (role === "support") {
    return response + "\n\nIf this didn’t fully solve it, I can investigate further.";
  }

  return response;
}

/* ---------------- Main hybrid response ---------------- */
export async function generateHybridResponse(
  userMessage: string,
  userId = "default-session"
): Promise<string> {
  try {
    await memoryService.addMessage(userId, "user", userMessage);

    const context = await buildDeepContext(userId, userMessage);
    const role = detectUserRole(userMessage);

    let response = await generateGemma(context);
    response = cleanResponse(response || "");
    let modelUsed = "Gemma";

    if (isLowConfidenceResponse(response)) {
      response = await generateGemini(context);
      response = cleanResponse(response || "");
      modelUsed = "Gemini";
    }

    response = enforceBotName(response, userMessage);
    response = injectSmartCTA(response, role, userMessage);

    await memoryService.addMessage(userId, "assistant", response);

    return response;

  } catch (err) {
    console.error("Hybrid response error:", err);
    return `Sorry — ${BOT_NAME} is temporarily unavailable.`;
  }
}
