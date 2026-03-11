import { getTopChunks } from "../queryChunks.js";
import { generateOpenRouter } from "./openRouterClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { aiIntents } from "./json_loader.js";

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

function normalize(text: string): string {

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

}

/* ================= BASIC INTENTS ================= */

const staticIntents = {

  greeting: ["hi","hello","hey"],
  identity: ["who are you","about yourself","tell me about yourself"],
  book: ["book","schedule","call","meeting"]

};

/* ================= SERVICE INTENTS ================= */

const serviceIntents = [

  { keyword: "youtube ads", intent: "youtube_ads" },
  { keyword: "cgi", intent: "cgi_ads" },
  { keyword: "seo", intent: "seo" },
  { keyword: "vso", intent: "vso" },
  { keyword: "email marketing", intent: "email_marketing" },
  { keyword: "real estate", intent: "real_estate" },
  { keyword: "villa", intent: "real_estate" },
  { keyword: "property", intent: "real_estate" },
  { keyword: "ecommerce", intent: "ecommerce" },
  { keyword: "gadget", intent: "tech" },
  { keyword: "travel", intent: "travel" }

];

function detectServiceIntent(text: string): string {

  const t = normalize(text);

  for (const s of serviceIntents) {

    if (t.includes(s.keyword)) return s.intent;

  }

  return "general";

}

/* ================= JSON INTENT MATCH ================= */

function findMatchingIntent(userMessage: string): string | null {

  const msgWords = normalize(userMessage).split(" ");

  let bestMatch: { score:number; response:string } | null = null;

  for (const intent of aiIntents) {

    if (!intent?.triggers?.length || !intent?.responses?.length) continue;

    let score = 0;

    for (const trig of intent.triggers) {

      const trigWords = normalize(trig).split(" ");

      const overlap = trigWords.filter((w)=>msgWords.includes(w)).length;

      score += trigWords.length ? overlap / trigWords.length : 0;

    }

    if (score > 0.55 && (!bestMatch || score > bestMatch.score)) {

      bestMatch = {
        score,
        response: intent.responses.filter(Boolean).join("\n\n")
      };

    }

  }

  return bestMatch?.response ?? null;

}

/* ================= VECTOR KNOWLEDGE ================= */

async function getEmbeddingKnowledge(
  userMessage:string,
  intent:string
):Promise<{text:string;count:number}> {

  try {

    const queries = [
      userMessage,
      `${intent} marketing`
    ];

    let collected:any[] = [];

    for (const q of queries) {

      const chunks = await getTopChunks(q,3,0.65);

      if (chunks?.length) collected.push(...chunks);

    }

    if (!collected.length) return { text:"", count:0 };

    const seen = new Set<string>();
    const arr:string[] = [];

    for (const c of collected) {

      const text = c?.text?.trim();

      if (!text || seen.has(text)) continue;

      seen.add(text);
      arr.push(text);

    }

    const finalChunks = arr.slice(0,4);

    return {
      text: finalChunks.join("\n\n"),
      count: finalChunks.length
    };

  }
  catch(err){

    console.error("Embedding retrieval error:",err);

    return { text:"", count:0 };

  }

}

/* ================= TIMEOUT WRAPPER ================= */

async function withTimeout<T>(
  promise:Promise<T>,
  ms:number
):Promise<T|null>{

  return new Promise((resolve)=>{

    const timer = setTimeout(()=>resolve(null),ms);

    promise
      .then(res=>{
        clearTimeout(timer);
        resolve(res);
      })
      .catch(()=>{
        clearTimeout(timer);
        resolve(null);
      });

  });

}

/* ================= REQUEST TYPE ================= */

interface HybridRequest {

  message:string;
  sessionId:string;
  history?:any[];

}

/* ================= MAIN HYBRID SYSTEM ================= */

export async function generateHybridResponse({
  message,
  sessionId,
  history=[]
}:HybridRequest):Promise<string>{

  try{

    const normalizedMessage = normalize(message);

    await memoryService.saveMessage(sessionId,"user",message);

    /* BASIC INTENTS */

    if (
      normalizedMessage.length < 15 &&
      staticIntents.greeting.includes(normalizedMessage)
    ){
      return `Hello. I am ${BOT_NAME}. How can I assist you today?`;
    }

    if (
      staticIntents.identity.some(t =>
        normalizedMessage.includes(normalize(t))
      )
    ){
      return `I am ${BOT_NAME}, the AI strategist for Digital Transition Marketing. I help businesses implement advanced AI marketing systems, automation, and digital growth strategies.`;
    }

    if (
      staticIntents.book.some(t =>
        normalizedMessage.includes(normalize(t))
      )
    ){
      return `You can schedule a strategy session here: https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future`;
    }

    /* MEMORY */

    let historyMessages:any[] = [];

    try{

      historyMessages = await memoryService.getRecentContext(sessionId);

    }
    catch{

      historyMessages = history.slice(-8);

    }

    const historyText = historyMessages
      .map(h => `${h.role==="user"?"User":"Assistant"}: ${h.content}`)
      .join("\n");

    /* INTENT */

    const detectedIntent = detectServiceIntent(message);

    /* KNOWLEDGE */

    const vector = await getEmbeddingKnowledge(message,detectedIntent);
    const jsonKnowledge = findMatchingIntent(message) ?? "";

    let knowledgePool = "";

    if (vector.text.length > 10)
      knowledgePool += `Company knowledge:\n${vector.text}\n\n`;

    if (jsonKnowledge.length > 20)
      knowledgePool += `Supporting information:\n${jsonKnowledge}\n\n`;

    /* PROMPT */

    const prompt = `
You are ${BOT_NAME}, AI strategist for Digital Transition Marketing.

Rules:

Only promote services offered by Digital Transition Marketing.

Never recommend external AI tools, platforms, or services.

Only describe services that exist in company knowledge.

Do not invent guarantees, statistics, pricing, phone numbers, or email addresses.

Respond professionally in clean natural paragraphs.

${knowledgePool}

Conversation history:
${historyText}

User question:
${message}

Provide a helpful response.
`;

    /* MODEL EXECUTION */

    const MIN_RESPONSE_LENGTH = 40;

    let response = "";
    let modelUsed = "none";

    if (process.env.OPENROUTER_API_KEY){

      const qwenResp = await withTimeout(
        generateOpenRouter(prompt),
        18000
      );

      if (qwenResp && qwenResp.length >= MIN_RESPONSE_LENGTH){

        response = cleanResponse(qwenResp);
        modelUsed = "Qwen";

      }

    }

    if ((!response || response.length < MIN_RESPONSE_LENGTH) && canUseGemini()){

      const geminiResp = await withTimeout(
        generateGemini(prompt),
        12000
      );

      if (geminiResp && geminiResp.length >= MIN_RESPONSE_LENGTH){

        response = cleanResponse(geminiResp);
        modelUsed = "Gemini";

        markGeminiUsed();

      }

    }

    if (!response){

      response = `I am ${BOT_NAME}. I help businesses implement AI marketing systems, performance advertising, automation, SEO, and digital growth strategies through Digital Transition Marketing.`;

      modelUsed = "fallback";

    }

    response = enforceBotName(response);

    await memoryService.saveMessage(sessionId,"assistant",response);

    console.log(
      `[Hybrid RAG] Model=${modelUsed} | Intent=${detectedIntent} | Chunks=${vector.count}`
    );

    return response;

  }
  catch(err){

    console.error("Hybrid RAG error:",err);

    return `I am ${BOT_NAME}. There was a temporary processing issue. Please try again shortly.`;

  }

}
