import fs from "fs";
import { fetchRelevantChunks } from "../queryChunksWrapper.js";
import { generateHybridResponse } from "./hybridClient.js";

// In-memory conversation memory
const conversationMemory: Record<string, string[]> = {};

/** Check if a question is repeated in the session */
function isRepeated(sessionId: string, question: string) {
  const lowerQ = question.trim().toLowerCase();
  if (!conversationMemory[sessionId]) conversationMemory[sessionId] = [];
  const repeated = conversationMemory[sessionId].includes(lowerQ);
  conversationMemory[sessionId].push(lowerQ);
  return repeated;
}

/** Core response manager for Neon Vision */
export async function getBotResponse(
  question: string,
  sessionId: string,
  context?: { pythonPath?: string }
): Promise<string> {
  if (!question || !question.trim()) return "Could you please rephrase that?";

  // 1️⃣ Repeated question check
  if (isRepeated(sessionId, question)) {
    return "You already asked that — here’s more context or clarification:";
  }

  const lowerQ = question.toLowerCase();

  // 2️⃣ Static response priority
  const staticResponses: { keywords: string[]; answer: string }[] = [
    {
      keywords: ["who are you", "your persona"],
      answer:
        "I am Neon Vision, the AI operating system of Digital Transition Marketing. I guide strategy, automate systems, and generate insights for maximum business growth.",
    },
    {
      keywords: ["mission", "objective", "goal"],
      answer:
        "Our mission is to empower businesses to dominate the digital future using AI-driven systems, automation, and performance strategy.",
    },
    {
      keywords: ["pricing", "cost", "how much", "price", "services cost"],
      answer:
        "Our pricing is customized based on scope, business size, and required growth systems. Tailored strategic proposals are provided after assessing client goals.",
    },
    { keywords: ["tagline"], answer: "Transitioning your business to the digital age." },
    {
      keywords: ["ideal client", "target market"],
      answer:
        "Ideal clients:\n• Real Estate Developers & Agencies\n• Travel & Tourism Agencies\n• E-commerce Brands",
    },
    {
      keywords: [
        "services",
        "ai capabilities",
        "offerings",
        "list your ai services",
        "do you have marketing automation services",
      ],
      answer:
        "Digital Transition Marketing offers 14 official AI-powered services:\n1. Voice Search Optimization (VSO)\n2. AI-Driven Email Marketing\n3. AI-Powered YouTube Ad Domination\n4. AI-Powered Website Design\n5. AI Virtual Tours\n6. AI-Powered Ad Warfare (Performance Marketing)\n7. AI Business Automation & Agents\n8. Next-Level Music Production\n9. Immersive CGI Marketing\n10. AI Video and Audio Production\n11. AI-Optimized Content\n12. AI-Powered Social Domination\n13. AI Search Domination (GEO & AI SEO)\n14. AI Predictive Analytics",
    },
  ];

  for (const r of staticResponses) {
    if (r.keywords.some((k) => lowerQ.includes(k))) {
      return r.answer;
    }
  }

  // 3️⃣ Embedding-based retrieval (only if Python available and not Render)
  let knowledgeContext = "";
  const isRender = !!process.env.RENDER || !!process.env.RENDER_SERVICE_NAME;

  if (context?.pythonPath && !isRender) {
    try {
      const chunks = await fetchRelevantChunks(question, 5);
      if (chunks.length > 0) {
        knowledgeContext = chunks.map((c) => c.summary).join("\n\n");
      }
    } catch (err) {
      console.warn("⚠️ Embedding retrieval skipped:", err);
    }
  } else if (isRender) {
    console.log("⚠️ Skipping embeddings on Render (safe).");
  } else {
    console.log("⚠️ Python not available locally. Embeddings skipped.");
  }

  // 4️⃣ Hybrid LLM (only if not Render)
  if (!isRender) {
    try {
      const hybridInput = knowledgeContext
        ? `${knowledgeContext}\n\nUser Question: ${question}`
        : question;

      const finalResponse = await generateHybridResponse(hybridInput, sessionId || "default");
      return finalResponse;
    } catch (err) {
      console.error("⚠️ Hybrid LLM error:", err);
    }
  } else {
    console.log("⚠️ Hybrid LLM skipped on Render.");
  }

  // 5️⃣ Fallback
  return (
    knowledgeContext ||
    "I can help with strategy, AI tools, marketing, and digital transformation. Could you clarify your question for a detailed answer?"
  );
}
