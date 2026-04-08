// ===================== IMPORTS ===================== //
// Core AI services
import { getFusedChunks } from "./intentVectorFusion.js";
import { generateOpenRouter } from "./openRouterClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";

// System utilities
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";

// Intent & Service detection
import { detectIntent } from "./intentManager.js";
import { detectService } from "./serviceDetector.js";

// Strategic logic & lead handling
import { strategicBrain } from "./strategicBrain.js";
import bookingFlow from "../bookingFlow.js";
import { analyzeLeadSignals } from "./leadIntelligence.js";
import { shouldTriggerBooking } from "./bookingTrigger.js";

// Modular helpers
import {
  detectBookingRejection,
  smartFallback as smartFallbackHelper,
  shouldIncludeCTA,
} from "./responseDecision.js";
import { compressContext } from "./responseUtilities.js";
import { GEMINI_ENABLED, canUseGemini, markGeminiUsed } from "./geminiManager.js";
import { withTimeout } from "./timeoutHelper.js";

import { neuralBrain } from "./neuralBrain.js";
import { normalizeLeadScore, determineExecutionMode } from "./leadScoreHelper.js";
import { smartGreeting } from "./greetingHelper.js";
import { checkHardResponses } from "./hardResponses.js";

// ===================== TYPES ===================== //
export interface BrainContext {
  stage?: string;
  intent?: string;
  reasoning?: string;
  leadScore?: number;
  detectedServices?: string[];
  detectedIntents?: string[];
  hasSufficientContext?: boolean;
  strategicMemory?: {
    industry?: string;
    businessType?: string;
  };
  executionMode?: string;
  isFresh?: boolean;
}

// ===================== UTILITY HELPERS ===================== //
function isLowQuality(text: string): boolean {
  if (!text) return true;
  return text.split(" ").length < 3 || text.trim().length < 20;
}

function looksIncomplete(text: string): boolean {
  if (!text) return true;
  return !/[.?!]$/.test(text.trim());
}

function compressResponse(text: string): string {
  return text.length > 1200 ? text.slice(0, 1200) + "..." : text;
}

function cleanHybridResponse(text: string): string {
  return cleanResponse(text).trim();
}

// ===================== HYBRID PROMPT BUILDER ===================== //
export function buildHybridPrompt({
  brainContext,
  leadScoreValue,
  detectedIntentNames,
  vectorText,
  historyText,
  message,
}: {
  brainContext: BrainContext;
  leadScoreValue: number;
  detectedIntentNames: string[];
  vectorText: string;
  historyText: string;
  message: string;
}) {
  const avoidQuestions =
    Boolean(brainContext?.hasSufficientContext) && brainContext?.stage !== "discovery";

  const knownContext = `
Known User Context:
${historyText || "No prior context available."}

Industry: ${brainContext?.strategicMemory?.industry ?? "unknown"}
Business Type: ${brainContext?.strategicMemory?.businessType ?? "unknown"}

IMPORTANT:
- Do NOT ask for information already provided
- Use this context to MOVE FORWARD (not repeat questions)
`.trim();

  return `
You are ${BOT_NAME}, a senior AI growth strategist from Digital Transition Marketing.

You think like a top 1% consultant — not a chatbot.

🔥 CORE OBJECTIVE
Solve the user's REAL business problem using strategy, not generic advice.

🚨 HARD RULES (NON-NEGOTIABLE)
- NEVER give generic advice
- NEVER repeat previous responses
- NEVER ignore provided context
- NEVER ask the same question again
- NEVER reset the conversation direction
- NEVER output vague frameworks without specificity

- ALWAYS:
  → Diagnose the ROOT problem
  → Give SPECIFIC, EXECUTABLE actions
  → Tie everything to RESULTS (revenue, leads, ROAS)

🧠 INTELLIGENCE MODE
Execution Mode: ${brainContext?.executionMode ?? "exploration"}

IF executionMode = "execution":
- DO NOT ask unnecessary questions
- Give DIRECT implementation steps
- Move toward action, plan, or next step

IF executionMode = "exploration":
- Diagnose deeply
- Ask MAX 1 high-value question (only if needed)

${avoidQuestions ? "CRITICAL: DO NOT ASK ANY QUESTIONS." : ""}

📊 USER CONTEXT
Stage: ${brainContext?.stage ?? "discovery"}
Lead Score: ${leadScoreValue?.toFixed(2) ?? "0.00"}
Intent: ${detectedIntentNames?.join(", ") || "general"}
Services: ${brainContext?.detectedServices?.join(", ") || "adaptive"}

Strategic Insight:
${brainContext?.reasoning ?? "No prior insight"}

User Maturity:
${leadScoreValue > 0.6 ? "HIGH INTENT (ready to act)" : "EXPLORING"}

🧩 KNOWN CONTEXT
${knownContext}

📚 KNOWLEDGE
${vectorText || "No vector knowledge available."}

👤 USER MESSAGE
${message}

🧠 THINKING INSTRUCTIONS
Before answering:

1. Identify the REAL underlying problem.
2. Determine the fastest path to measurable improvement.
3. Give exact, actionable steps tied to outcomes.

✍️ RESPONSE STRUCTURE

1. Identify the REAL problem (specific, not generic)
2. Provide a CLEAR, EXECUTABLE solution
   - Steps
   - Tactics
   - Strategy tied to outcome
3. Optional: ONE sharp follow-up question ONLY if necessary

🚫 ANTI-GENERIC ENFORCEMENT

❌ BAD: "Use SEO, ads, and content marketing"
✅ GOOD: "Your YouTube ads are underperforming because the first 3 seconds fail — test 5 new hooks targeting [specific audience]"

🎯 FINAL RULES
- Be sharp, direct, and strategic
- Sound like a human expert
- Avoid fluff, filler, repetition
- Prefer depth over surface-level advice
- If context exists → MOVE FORWARD, don’t reset
`.trim();
}

// ===================== HYBRID EXECUTION ===================== //
export async function executeHybridResponse({
  sessionId,
  message,
  brainContext,
  leadScoreValue,
  detectedIntentNames,
  vectorText,
  historyText,
  recentMessagesCache,
  intentCategories,
  forceNoQuestions = false,
}: {
  sessionId: string;
  message: string;
  brainContext: BrainContext;
  leadScoreValue: number;
  detectedIntentNames: string[];
  vectorText: string;
  historyText: string;
  recentMessagesCache: any[];
  intentCategories: string[];
  forceNoQuestions?: boolean;
}) {
  try {
    // 1️⃣ Hard response override
    const hardResponse = checkHardResponses(message);
    if (hardResponse) {
      await memoryService.saveMessage(sessionId, "assistant", hardResponse);
      return hardResponse;
    }

    // 2️⃣ Dynamic greeting
    const greetingResp = await smartGreeting(brainContext, recentMessagesCache);
    if (greetingResp) {
      await memoryService.saveMessage(sessionId, "assistant", greetingResp);
      return greetingResp;
    }

    // 3️⃣ Detect services & intents
    brainContext.detectedServices = [];
    brainContext.detectedIntents = [];

    const detectedServices = await detectService(message);
    brainContext.detectedServices = Array.isArray(detectedServices)
      ? detectedServices.filter((s): s is string => typeof s === "string")
      : [];

    const detectedIntentsRaw = detectIntent(message);
    brainContext.detectedIntents = Array.isArray(detectedIntentsRaw)
      ? detectedIntentsRaw.map((i) => (i?.intent && typeof i.intent === "string" ? i.intent : "unknown"))
      : [];

    // 4️⃣ Vector fusion
    let fusedChunksText = "";
    try {
      const chunks = await getFusedChunks(message, 3);
      fusedChunksText = chunks.map((c) => c.text).filter(Boolean).join("\n\n");
    } catch (err) {
      console.warn("[Hybrid] Vector fusion failed:", err);
    }

    // 5️⃣ Build hybrid prompt
    const prompt = buildHybridPrompt({
      brainContext,
      leadScoreValue,
      detectedIntentNames,
      vectorText: fusedChunksText,
      historyText,
      message,
    });

    // 6️⃣ AI model execution
    let response = "";
    try {
      const qwenResp = await withTimeout(generateOpenRouter(prompt, sessionId), 6500);
      if (qwenResp && !isLowQuality(qwenResp) && !looksIncomplete(qwenResp)) {
        response = qwenResp;
      } else if (canUseGemini()) {
        const geminiResp = await withTimeout(generateGemini(prompt), 4500);
        if (geminiResp && !looksIncomplete(geminiResp)) {
          response = geminiResp;
          markGeminiUsed();
        }
      }
    } catch (err) {
      console.warn("[Hybrid] AI execution failed:", err);
    }

    // 7️⃣ Fallback if low quality or empty
    if (!response || (isLowQuality(response) && response.trim().length < 20)) {
      response = smartFallbackHelper();
    }

    // 8️⃣ Cleanup, enforce bot name
    response = cleanHybridResponse(response);
    if (forceNoQuestions) response = response.replace(/\?+/g, ".");
    response = enforceBotName(response);

    // 9️⃣ Intelligent CTA
    if (
      response &&
      !response.includes("Tell me your goal") &&
      shouldIncludeCTA(message, intentCategories, leadScoreValue, brainContext.stage)
    ) {
      response +=
        "\n\nWant me to map this into a step-by-step execution plan tailored to your business?";
    }

    // 🔟 Save assistant response to memory
    await memoryService.saveMessage(sessionId, "assistant", response);

    return response;
  } catch (err) {
    console.error("[Hybrid] Execution error:", err);
    return "Something went wrong — please try again.";
  }
}

// ===================== HYBRID RESPONSE SERVICE ===================== //
export const hybridResponseService = {
  detectServices: (message: string): string[] => {
    if (!message || typeof message !== "string") return [];
    const lowered = message.toLowerCase();
    const servicesSet = new Set<string>();
    const mappings: { regex: RegExp; service: string }[] = [
      { regex: /voice|vso|position zero|featured snippets/, service: "Voice Search Optimization (VSO)" },
      { regex: /email|ai-powered email|automation|klaviyo/, service: "AI-Powered Email Marketing" },
      { regex: /youtube|video funnel|ad domination|ai-optimized scripts/, service: "AI-Powered YouTube Ad Domination" },
      { regex: /website|web design|mobile-first|seo|core web vitals/, service: "AI-Powered Website Design" },
      { regex: /360 tour|virtual tour|nerf|mortgage calculator/, service: "AI Virtual Tours" },
      { regex: /performance marketing|ad warfare|algorithmic bidding|predictive audience/, service: "AI-Powered Ad Warfare (Performance Marketing)" },
      { regex: /automation|ai agents|self-healing|pre-trained llama|workflow/, service: "AI Business Automation & AI Agents" },
      { regex: /music|audio|mixing|mastering|track production/, service: "Next-Level Music Production" },
      { regex: /cgi|immersive|cinematic|3d animation|photorealistic/, service: "Immersive CGI Marketing" },
      { regex: /video production|audio production|spatial audio|voiceover/, service: "AI Video and Audio Production" },
      { regex: /content|blog|script|case study|ai-optimized content/, service: "AI-Optimized Content" },
      { regex: /social|linkedin|reels|community management|shadowban/, service: "AI-Powered Social Domination" },
      { regex: /geo|ai seo|generative engine|search domination/, service: "AI Search Domination (GEO & AI SEO)" },
      { regex: /predictive analytics|hedge fund|sentiment analysis|dark pool/, service: "AI Predictive Analytics" },
    ];
    for (const { regex, service } of mappings) if (regex.test(lowered)) servicesSet.add(service);
    return Array.from(servicesSet);
  },
};
