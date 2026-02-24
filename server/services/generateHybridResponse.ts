// server/services/generateHybridResponse.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getTopChunks } from "../queryChunks.js";
import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { formatResponse } from "../utils/formatResponse.js";

/* ================= GEMINI CONFIG ================= */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENABLED = Boolean(GEMINI_API_KEY && GEMINI_API_KEY.length > 20);
const GEMINI_DAILY_LIMIT = 20;

let geminiUsage = { count: 0, lastReset: Date.now() };

function canUseGemini(): boolean {
  if (!GEMINI_ENABLED) return false;
  const now = Date.now();
  const ONE_DAY = 86400000;
  if (now - geminiUsage.lastReset > ONE_DAY) {
    geminiUsage.count = 0;
    geminiUsage.lastReset = now;
  }
  return geminiUsage.count < GEMINI_DAILY_LIMIT;
}

function markGeminiUsed() {
  geminiUsage.count++;
}

/* ================= NORMALIZATION ================= */
function normalize(text: string) {
  return text.toLowerCase().replace(/[^\w\s]/g, "").trim();
}

/* ================= STATIC INTENTS ================= */
const staticIntents = {
  greeting: ["hi", "hello", "hey"],
  identity: ["who are you", "about yourself", "tell me about yourself"],
  service: ["service", "services", "list services"],
  pricing: ["pricing", "price", "cost", "how much", "package"],
  tagline: ["tagline", "slogan"],
  targetMarket: ["target market", "ideal client", "who do you serve"],
  mission: ["mission"],
  niches: ["niches", "specialize", "industry"]
};

const greetingVariations = [
  `Hello! How can I assist you today?`,
  `Hi there! Ready to guide your business growth with AI-powered strategies.`,
  `Greetings! Let's explore how to accelerate your business digitally.`
];

/* ================= PERSONA ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================= AI LOGIC ================= */
const aiLogicRoot = path.join(process.cwd(), "server", "ai_logic_converted");
const aiIntents: any[] = [];

function loadJSONRecursive(dir: string) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, f);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      loadJSONRecursive(fullPath);
    } else if (f.endsWith(".json")) {
      try {
        const json = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
        if (Array.isArray(json.triggers) && Array.isArray(json.responses)) {
          aiIntents.push(json);
        }
      } catch (err) {
        console.warn(`Failed to load JSON: ${fullPath}`, err);
      }
    }
  }
}

loadJSONRecursive(aiLogicRoot);
console.log(`✅ Loaded ${aiIntents.length} AI logic JSON intents`);

/* ================= SEMANTIC JSON MATCH ================= */
function findMatchingIntent(userMessage: string) {
  const msg = normalize(userMessage);
  const matches: { score: number; response: string }[] = [];

  for (const intent of aiIntents) {
    for (const trig of intent.triggers) {
      const trigNorm = normalize(trig);
      if (msg.includes(trigNorm)) {
        matches.push({ score: 1, response: intent.responses.join("\n\n") });
        continue;
      }
      const msgWords = msg.split(" ");
      const trigWords = trigNorm.split(" ");
      const matchCount = trigWords.filter(word => msgWords.includes(word)).length;
      const score = matchCount / trigWords.length;
      if (score >= 0.3) matches.push({ score, response: intent.responses.join("\n\n") });
    }
  }

  if (matches.length === 0) return null;

  // Sort descending by score and combine top 3
  matches.sort((a, b) => b.score - a.score);
  const topResponses = matches.slice(0, 3).map(m => m.response);
  console.log("Top JSON matches:", topResponses);
  return topResponses.join("\n\n");
}

/* ================= EMBEDDINGS ================= */
async function getEmbeddingKnowledge(userMessage: string) {
  try {
    const chunks = await getTopChunks(userMessage, 15, 0.15); // prioritize relevance
    if (!chunks || chunks.length === 0) return "";
    const topChunks = chunks.map(c => c.text).filter(Boolean);
    console.log("Top embedding chunks:", topChunks);
    return topChunks.join("\n\n");
  } catch (err) {
    console.error("Error retrieving embeddings:", err);
    return "";
  }
}

/* ================= MAIN RESPONSE ================= */
export async function generateHybridResponse(
  userMessage: string,
  userId = "default-session"
): Promise<string> {
  try {
    await memoryService.addMessage(userId, "user", userMessage);
    const msg = normalize(userMessage);

    /* ===== GREETING ===== */
    if (staticIntents.greeting.includes(msg)) {
      const r = greetingVariations[Math.floor(Math.random() * greetingVariations.length)];
      await memoryService.addMessage(userId, "assistant", r);
      return r;
    }

    /* ===== IDENTITY ===== */
    if (staticIntents.identity.some(t => msg.includes(t))) {
      const r = `I guide businesses through AI-driven marketing, automation, performance advertising, and digital growth systems.`;
      await memoryService.addMessage(userId, "assistant", r);
      return r;
    }

    /* ===== STATIC MAP ===== */
    const staticMap: Record<string,string> = {
      tagline: "Transitioning your business to the digital age.",
      targetMarket: "Ideal clients: • Real Estate Developers & Agencies • Travel & Tourism Agencies • E-commerce Brands",
      mission: "Our mission is to empower businesses to dominate the digital future using AI-driven systems, automation, and performance strategy.",
      niches: "Specialties: • Real Estate — CGI ads & virtual property tours • Travel & Tourism — AI marketing & automation • E-commerce — scalable growth systems & paid acquisition"
    };

    for (const key of Object.keys(staticMap)) {
      if (staticIntents[key as keyof typeof staticIntents]?.some(t => msg.includes(t))) {
        const r = staticMap[key];
        await memoryService.addMessage(userId, "assistant", r);
        return r;
      }
    }

    /* ================= KNOWLEDGE RETRIEVAL ================= */
    const embeddingKnowledge = await getEmbeddingKnowledge(userMessage); // PRIORITY
    const jsonKnowledge = findMatchingIntent(userMessage); // SECONDARY

    let knowledgePool = "";
    if (embeddingKnowledge) knowledgePool += `PRIMARY DATA (Embeddings):\n${embeddingKnowledge}\n\n`;
    if (jsonKnowledge) knowledgePool += `SECONDARY DATA (JSON Intents):\n${jsonKnowledge}\n\n`;
    const hasKnowledge = Boolean(knowledgePool);

    /* ================= MODEL PROMPT ================= */
    const prompt = `
You are ${BOT_NAME}, AI Strategist for Digital Transition Marketing (DTM).
You are fully trained on the company's internal knowledge base.

PRIMARY DATA (embeddings) must always be prioritized.
SECONDARY DATA (structured JSON) can be used if it enhances the answer.

Internal Knowledge:
${hasKnowledge ? knowledgePool : "No direct match found. Use strategic domain reasoning."}

User Question:
${userMessage}

Provide a confident, professional, and complete response.
Never give generic answers.
Do NOT disclaim missing information if context is available.
`;

    /* ================= GENERATE RESPONSE ================= */
    let response = cleanResponse(await generateGemma(prompt));
    let modelUsed = "Gemma";
    console.log("Gemma raw response:", response);

    if ((!response || response.length < 25) && canUseGemini()) {
      try {
        response = cleanResponse(await generateGemini(prompt));
        markGeminiUsed();
        modelUsed = "Gemini";
        console.log("Gemini raw response:", response);
      } catch (err) {
        console.error("Gemini generation failed:", err);
      }
    }

    response = enforceBotName(response);

    /* ================= FINAL FALLBACK ONLY IF NO KNOWLEDGE ================= */
    if ((!response || response.length < 25) && !hasKnowledge) {
      if (msg.includes("book") || msg.includes("schedule") || msg.includes("call")) {
        response = "Sure — you can book a strategy call here: https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future";
      } else {
        response = "I can provide strategic guidance on AI marketing, automation, paid advertising, SEO, CGI property tours, and digital growth systems. Could you clarify which specific area you'd like to explore?";
      }
    }

    console.log(`[Hybrid] Model=${modelUsed} | EMB=${!!embeddingKnowledge} | JSON=${!!jsonKnowledge}`);

    await memoryService.addMessage(userId, "assistant", response);
    return formatResponse(null, [{ content: response }], {});
  } catch (err) {
    console.error("Hybrid error:", err);
    return "We’re experiencing a temporary processing issue.";
  }
}	

