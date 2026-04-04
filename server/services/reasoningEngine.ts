// server/services/reasoningEngine.ts
import { memoryService } from "./memoryService.js";

/* ================= TYPES ================= */
export type ReasoningData = {
  problem: string;
  industry: string;
  strategy: string;
  recentMessages: { role: string; content: string }[];
};

/* ================= STRATEGIC MEMORY TYPE ================= */
export type StrategicMemory = {
  industry?: string;
  servicesDiscussed?: string[];
  businessMentioned?: boolean;
  painPoints?: string[];
  goals?: string[];
  [key: string]: any;
};

/* ================= Reasoning Engine ================= */
export class ReasoningEngine {
  /* -------------------- Main analyze -------------------- */
  async analyze(sessionId: string, userQuestion: string): Promise<ReasoningData> {
    const [recentContextRaw, strategicMemoryRaw] = await Promise.all([
      memoryService.getRecentContext(sessionId).catch(() => []),
      memoryService.getStrategicMemory(sessionId).catch(() => ({} as StrategicMemory)),
    ]);

    const strategicMemory: StrategicMemory = strategicMemoryRaw || {};
    const question = userQuestion.toLowerCase();

    /* ---------- PROBLEM ---------- */
    const problem = this.extractProblem(question, strategicMemory);

    /* ---------- INDUSTRY ---------- */
    const industry =
      strategicMemory.industry ||
      this.guessIndustry(question, recentContextRaw);

    /* ---------- STRATEGY ---------- */
    const baseStrategy = this.suggestStrategy(question, industry, problem);

    /* ---------- CONTEXT PROCESSING ---------- */
    const recentMessages = recentContextRaw.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    /* ---------- DYNAMIC OUTPUT ---------- */
    const strategy = this.dynamicStrategy(baseStrategy, {
      problem,
      industry,
      contextLength: recentMessages.length,
    });

    return {
      problem,
      industry,
      strategy,
      recentMessages,
    };
  }

  /* ================= PROBLEM DETECTION ================= */
  private extractProblem(question: string, memory: StrategicMemory): string {
    const q = question;

    // Strong signals first
    if (q.includes("low roas") || q.includes("bad roas")) return "low_roas";
    if (q.includes("no sales") || q.includes("not getting sales")) return "no_sales";
    if (q.includes("conversion") || q.includes("not converting")) return "conversion";
    if (q.includes("traffic") || q.includes("visitors")) return "traffic";

    // Goal-based fallback
    if (q.includes("grow") || q.includes("scale") || q.includes("increase")) return "growth";

    // Memory fallback
    if (memory?.painPoints?.length) return memory.painPoints[0];

    return "general";
  }

  /* ================= INDUSTRY DETECTION ================= */
  private guessIndustry(question: string, context: any[]): string {
    const q = question;

    if (q.includes("ecommerce") || q.includes("store") || q.includes("shop"))
      return "ecommerce";

    if (q.includes("real estate") || q.includes("property"))
      return "real_estate";

    if (q.includes("travel") || q.includes("tourism"))
      return "travel";

    // Look into past messages (VERY IMPORTANT)
    const combined = context.map((m) => m.content.toLowerCase()).join(" ");

    if (combined.includes("ecommerce")) return "ecommerce";
    if (combined.includes("real estate")) return "real_estate";

    return "general";
  }

  /* ================= STRATEGY ENGINE ================= */
  private suggestStrategy(
    question: string,
    industry: string,
    problem: string
  ): string {
    /* ---------- ECOMMERCE ---------- */
    if (industry === "ecommerce") {
      if (problem === "low_roas") {
        return "Fix creative fatigue, improve targeting, and optimize product-page conversion flow";
      }
      if (problem === "no_sales") {
        return "Audit funnel, fix trust signals, and align offer with audience intent";
      }
      if (problem === "conversion") {
        return "Optimize landing pages, improve UX, and run A/B testing on key elements";
      }
      if (problem === "traffic") {
        return "Scale paid ads + SEO + short-form content distribution";
      }
      if (problem === "growth") {
        return "Combine paid acquisition, CRO, and retention systems for scalable growth";
      }
    }

    /* ---------- REAL ESTATE ---------- */
    if (industry === "real_estate") {
      if (problem === "low_roas") {
        return "Improve ad creatives using high-end CGI and refine luxury audience targeting";
      }
      if (problem === "conversion") {
        return "Use virtual tours + lead qualification funnels to increase buyer intent";
      }
      if (problem === "growth") {
        return "Leverage high-ticket funnels, CGI experiences, and targeted ad campaigns";
      }
    }

    /* ---------- TRAVEL ---------- */
    if (industry === "travel") {
      if (problem === "traffic") {
        return "Focus on SEO + destination content + social distribution";
      }
      if (problem === "conversion") {
        return "Optimize booking flow + retargeting campaigns";
      }
    }

    /* ---------- DEFAULT ---------- */
    return "Use a combination of content, paid marketing, and conversion optimization to improve performance";
  }

  /* ================= DYNAMIC STRATEGY ================= */
  private dynamicStrategy(
    base: string,
    context: { problem: string; industry: string; contextLength: number }
  ): string {
    const { problem, industry, contextLength } = context;

    const templates = [
      `${base}.`,
      `Based on your ${industry} setup, the focus should be: ${base}.`,
      `The core issue seems to be ${problem}. Best move: ${base}.`,
      `Right now, the highest-impact move is: ${base}.`,
    ];

    return templates[contextLength % templates.length];
  }
}

/* ================= Singleton ================= */
export const reasoningEngine = new ReasoningEngine();
