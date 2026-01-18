// server/services/generateHybridResponse.ts

import { fetchRelevantChunks } from "../queryChunksWrapper.js";
import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { formatResponse } from "../utils/formatResponse.js";
import { CALENDLY_LINK } from "../config/constants.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/* ---------------- ESM-safe __dirname ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- SAFE PERSONA LOADER ---------------- */
const personaDir = path.join(__dirname, "../personas");
const personaFile = "neon-vision.json";
const personaPath = path.join(personaDir, personaFile);

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
    const personaData = fs.readFileSync(personaPath, "utf-8");
    systemPersona = JSON.parse(personaData);
    console.log(`✅ Persona loaded: ${personaFile}`);
  } else {
    console.warn(`⚠️ Persona file "${personaFile}" not found at ${personaDir}, using fallback persona`);
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

/* ---------------- Memory formatter ---------------- */
function formatMemory(history: any[]) {
  if (!history || history.length === 0) return "No prior conversation.";
  return history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
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

/* ---------------- Small LLM summarizer for sources ---------------- */
async function summarizeSource(sourceText: string): Promise<string> {
  try {
    if (!sourceText || sourceText.trim() === "") return "(no info)";
    const prompt = `Summarize the following source into a concise bullet point:\n${sourceText}`;
    const summary = await generateGemma(prompt); // Using Gemma as summarizer
    return cleanResponse(summary || sourceText);
  } catch {
    return sourceText || "(no info)";
  }
}

/* ---------------- Context builder ---------------- */
async function buildDeepContext(userId: string, userMessage: string) {
  const relevantChunks = await fetchRelevantChunks(userMessage, 5);
  const history = await memoryService.getHistory(userId);
  const role = detectUserRole(userMessage);

  // Phase 4+: automatic summarization of each source with safe fallback
  let sourcesSummary: string;
  if (relevantChunks.length > 0) {
    const summaries = await Promise.all(
      relevantChunks.map((c: any) => summarizeSource(c.summary || c.source || "(no info)"))
    );
    sourcesSummary = summaries.map((s) => `• ${s}`).join("\n");
  } else {
    sourcesSummary = "No relevant sources found.";
  }

  return {
    context: `
${buildPersonaInstructions(systemPersona)}

USER ROLE:
${role}

CONVERSATION HISTORY:
${formatMemory(history)}

RELEVANT KNOWLEDGE:
${JSON.stringify(relevantChunks)}

USER MESSAGE:
${userMessage}
`,
    sourcesSummary
  };
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
    return response + `\n\n ~E Book a call here:\n${CALENDLY_LINK}`;
  }
  if (role === "marketing") {
    return response + "\n\nWould you like a quick campaign strategy or funnel plan?";
  }
  if (role === "support") {
    return response + "\n\nIf this didn’t fully solve it, I can investigate further.";
  }
  return response;
}

/* ---------------- MAIN HYBRID RESPONSE (Phase 4+) ---------------- */
export async function generateHybridResponse(
  userMessage: string,
  userId = "default-session"
): Promise<string> {
  try {
    await memoryService.addMessage(userId, "user", userMessage);

    const { context, sourcesSummary } = await buildDeepContext(userId, userMessage);
    const role = detectUserRole(userMessage);

    let response = await generateGemma(context);
    response = cleanResponse(response || "");
    let modelUsed = "Gemma";

    if (isLowConfidenceResponse(response)) {
      response = await generateGemini(context);
      response = cleanResponse(response || "");
      modelUsed = "Gemini";
    }

    console.log(`[Hybrid Phase4+] Model used: ${modelUsed}, User: ${userId}, Role: ${role}`);
    console.log(`[Hybrid Phase4+] Sources Summary:\n${sourcesSummary}`);

    response = enforceBotName(response, userMessage);
    response = injectSmartCTA(response, role, userMessage);

    await memoryService.addMessage(userId, "assistant", response);

    /* ---------------- PHASE-4+ FINAL FORMAT ---------------- */
    return formatResponse(
      "Neon Vision — Digital Transition Marketing",
      [
        { heading: "Response", content: response },
        { heading: "Sources Summary", content: sourcesSummary.split("\n") }
      ],
      { includeCalendly: role === "sales" }
    );

  } catch (err) {
    console.error("Hybrid Phase4+ response error:", err);
    return `Sorry — ${BOT_NAME} is temporarily unavailable.`;
  }
}
