// server/services/generateHybridResponse.ts

import { getEmbedding } from "../embeddings.js";
import { getTopChunks } from "../queryChunks.js";
import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { formatResponse } from "../utils/formatResponse.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/* ================= GEMINI QUOTA MANAGER ================= */
const GEMINI_DAILY_LIMIT = 20;
let geminiUsage = { count: 0, lastReset: Date.now() };

function resetIfNeeded() {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  if (now - geminiUsage.lastReset > ONE_DAY) {
    geminiUsage.count = 0;
    geminiUsage.lastReset = now;
    console.log("♻️ Gemini quota reset");
  }
}

function canUseGemini(): boolean {
  resetIfNeeded();
  return geminiUsage.count < GEMINI_DAILY_LIMIT;
}

function markGeminiUsed() {
  geminiUsage.count++;
}

/* ---------------- ESM-safe __dirname ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- Persona loader ---------------- */
const personaPath = path.join(__dirname, "../personas/neon-vision.json");
let systemPersona: any = {
  name: BOT_NAME,
  tone: "professional, clear, helpful",
  rules: [
    "Answer only using company knowledge",
    "Do not exaggerate or invent services",
    "Be concise and structured",
    "Sound calm and premium, not promotional",
  ],
};
try {
  if (fs.existsSync(personaPath)) {
    systemPersona = JSON.parse(fs.readFileSync(personaPath, "utf-8"));
    console.log("✅ Persona loaded");
  }
} catch {
  console.warn("⚠️ Persona fallback active");
}

/* ---------------- AI Logic loader ---------------- */
const aiLogicDir = path.join(process.cwd(), "server", "ai_logic");
let aiLogicRules: any[] = [];

function collectJsonFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectJsonFiles(fullPath);
    return entry.name.endsWith(".json") ? [fullPath] : [];
  });
}

try {
  if (fs.existsSync(aiLogicDir)) {
    const files = collectJsonFiles(aiLogicDir);
    aiLogicRules = files.map((f) =>
      JSON.parse(fs.readFileSync(f, "utf-8"))
    );
    console.log(`✅ Loaded ${aiLogicRules.length} AI logic JSON files`);
  }
} catch (err) {
  console.warn("⚠️ Failed to load AI logic JSONs", err);
}

/* ---------------- Memory helpers ---------------- */
function formatMemory(history: any[]) {
  if (!history?.length) return "";
  return history
    .slice(-6)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
}

function buildPersonaInstructions(persona: any) {
  return `
You are ${persona.name}.
Tone: ${persona.tone}.
Rules:
${persona.rules.map((r: string) => `- ${r}`).join("\n")}
`;
}

/* ---------------- Context builder ---------------- */
async function buildDeepContext(userId: string, userMessage: string) {
  const embedding = await getEmbedding(userMessage);
  const relevantChunks = await getTopChunks(embedding, 8);
  const history = await memoryService.getHistory(userId);

  const knowledgeText = relevantChunks
    .map((c) => c.content || "")
    .filter(Boolean)
    .join("\n\n");

  const aiLogicText = aiLogicRules.map((r) => JSON.stringify(r)).join("\n");

  return {
    hasKnowledge: Boolean(knowledgeText.trim()),
    context: `
${buildPersonaInstructions(systemPersona)}

CONVERSATION HISTORY:
${formatMemory(history)}

COMPANY KNOWLEDGE:
${knowledgeText}

AI LOGIC:
${aiLogicText}

USER QUESTION:
${userMessage}
`,
  };
}

/* ---------------- Quality detector ---------------- */
function isNonAnswer(text: string) {
  return !text || text.trim().length < 80;
}

/* ================= MAIN HYBRID RESPONSE ================= */
export async function generateHybridResponse(
  userMessage: string,
  userId = "default-session"
): Promise<string> {
  try {
    await memoryService.addMessage(userId, "user", userMessage);

    const { context, hasKnowledge } = await buildDeepContext(userId, userMessage);

    // Step 1: always try Gemma first
    let response = cleanResponse(await generateGemma(context));
    let modelUsed = "Gemma";

    // Step 2: If Gemma fails or is generic, use Gemini if KB exists
    if (isNonAnswer(response) && hasKnowledge && canUseGemini()) {
      try {
        response = cleanResponse(await generateGemini(context));
        markGeminiUsed();
        modelUsed = "Gemini";
      } catch {
        console.warn("❌ Gemini failed — continuing with Gemma");
      }
    }

    // Step 3: Smart dynamic fallback if still non-answer
    if (isNonAnswer(response)) {
      response = hasKnowledge
        ? `Based on our internal knowledge, here is what Digital Transition Marketing can offer:\n\n${context
            .split("COMPANY KNOWLEDGE:")[1]
            .split("AI LOGIC:")[0]
            .trim()}`
        : `I’m ${BOT_NAME}, the AI assistant for Digital Transition Marketing. I can help you understand our services, strategies, and digital solutions.`;
    }

    response = enforceBotName(response);

    console.log(
      `[Hybrid] Model=${modelUsed} Gemini=${geminiUsage.count}/${GEMINI_DAILY_LIMIT} | User="${userMessage}" | ResponseLength=${response.length}`
    );

    await memoryService.addMessage(userId, "assistant", response);

    return formatResponse(null, [{ content: response }], {});
  } catch (err) {
    console.error("Hybrid response error:", err);
    return `Sorry — ${BOT_NAME} is temporarily unavailable.`;
  }
}
