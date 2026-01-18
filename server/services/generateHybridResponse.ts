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
  tone: "professional, confident, clear",
  rules: [
    "Use company knowledge accurately",
    "Mention services when relevant",
    "Never say services do not exist if knowledge is available",
    "Be concise but informative"
  ]
};

try {
  if (fs.existsSync(personaPath)) {
    systemPersona = JSON.parse(fs.readFileSync(personaPath, "utf-8"));
    console.log(`✅ Persona loaded: ${personaFile}`);
  }
} catch {
  console.warn("⚠️ Persona fallback active");
}

/* ---------------- Role detection ---------------- */
function detectUserRole(msg: string): string {
  const t = msg.toLowerCase();
  if (t.includes("price") || t.includes("pricing") || t.includes("buy") || t.includes("call"))
    return "sales";
  if (t.includes("campaign") || t.includes("marketing"))
    return "marketing";
  if (t.includes("issue") || t.includes("help"))
    return "support";
  return "general";
}

/* ---------------- Memory formatter ---------------- */
function formatMemory(history: any[]) {
  if (!history || history.length === 0) return "";
  return history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
}

/* ---------------- Persona instruction builder ---------------- */
function buildPersonaInstructions(persona: any) {
  return `
You are ${persona.name}.
Tone: ${persona.tone}.
Rules:
${persona.rules.map((r: string) => `- ${r}`).join("\n")}
`;
}

/* ---------------- Source summarizer ---------------- */
async function summarizeSource(text: string) {
  if (!text || text.trim().length < 30) return null;
  const summary = await generateGemma(
    `Summarize this into one factual bullet:\n${text}`
  );
  return cleanResponse(summary || "");
}

/* ---------------- Context builder ---------------- */
async function buildDeepContext(userId: string, userMessage: string) {
  const relevantChunks = await fetchRelevantChunks(userMessage, 8);
  const history = await memoryService.getHistory(userId);
  const role = detectUserRole(userMessage);

  const knowledgeText = relevantChunks
    .map(c => c.source)
    .filter(Boolean)
    .join("\n\n");

  const summaries = await Promise.all(
    relevantChunks.map(c => summarizeSource(c.source))
  );

  return {
    role,
    context: `
${buildPersonaInstructions(systemPersona)}

CONVERSATION HISTORY:
${formatMemory(history)}

COMPANY KNOWLEDGE (USE THIS FIRST):
${knowledgeText}

USER QUESTION:
${userMessage}
`,
    sourcesSummary: summaries.filter(Boolean)
  };
}

/* ---------------- Confidence heuristic ---------------- */
function isLowConfidenceResponse(text: string) {
  return !text || text.length < 60 || /no information|not available/i.test(text);
}

/* ---------------- CTA injector ---------------- */
function injectSmartCTA(response: string, role: string, userMessage: string) {
  if (
    role === "sales" &&
    /call|book|schedule/i.test(userMessage) &&
    !response.includes(CALENDLY_LINK)
  ) {
    response += `\n\n📞 Book a strategy call:\n${CALENDLY_LINK}`;
  }
  return response;
}

/* ---------------- MAIN HYBRID RESPONSE ---------------- */
export async function generateHybridResponse(
  userMessage: string,
  userId = "default-session"
): Promise<string> {
  try {
    await memoryService.addMessage(userId, "user", userMessage);

    const { context, sourcesSummary, role } =
      await buildDeepContext(userId, userMessage);

    let response = cleanResponse(await generateGemma(context));
    let modelUsed = "Gemma";

    if (isLowConfidenceResponse(response)) {
      response = cleanResponse(await generateGemini(context));
      modelUsed = "Gemini";
    }

    console.log(`[Hybrid] Model: ${modelUsed} | Role: ${role}`);

    response = enforceBotName(response, userMessage);
    response = injectSmartCTA(response, role, userMessage);

    await memoryService.addMessage(userId, "assistant", response);

    return formatResponse(
      "Neon Vision — Digital Transition Marketing",
      [
        { heading: "Response", content: response },
        {
          heading: "Sources Summary",
          content: (sourcesSummary.filter(Boolean) as string[]).length
            ? (sourcesSummary.filter(Boolean) as string[])
            : ["Internal knowledge base"]
        }
      ],
      { includeCalendly: false }
    );
  } catch (err) {
    console.error("Hybrid response error:", err);
    return `Sorry — ${BOT_NAME} is temporarily unavailable.`;
  }
}
