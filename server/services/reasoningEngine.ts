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

/* ================= UTILS ================= */
function safeString(val: any): string {
  if (!val || typeof val !== "string") return "";
  return val.toLowerCase().trim();
}

/* ================= Reasoning Engine ================= */
export class ReasoningEngine {

  /* -------------------- MAIN -------------------- */
  async analyze(sessionId: string, userQuestion: string): Promise<ReasoningData> {

    const [recentContextRaw, strategicMemoryRaw] = await Promise.all([
      memoryService.getRecentContext(sessionId).catch(() => []),
      memoryService.getStrategicMemory(sessionId).catch(() => ({})),
    ]);

    const strategicMemory: StrategicMemory = strategicMemoryRaw || {};
    const question = safeString(userQuestion);

    /* ---------- PROBLEM ---------- */
    const problem = this.extractProblem(question, strategicMemory);

    /* ---------- INDUSTRY ---------- */
    const industry =
      strategicMemory.industry ||
      this.guessIndustry(question, recentContextRaw);

    /* ---------- BASE STRATEGY ---------- */
    const baseStrategy = this.suggestStrategy(question, industry, problem);

    /* ---------- CONTEXT ---------- */
    const recentMessages = (recentContextRaw || []).map((m: any) => ({
      role: typeof m?.role === "string" ? m.role : "user",
      content: safeString(m?.content),
    }));

    /* ---------- FINAL STRATEGY ---------- */
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

    if (!question) return "general";

    /* ---------- STRONG SIGNALS ---------- */
    if (/low\s*roas|bad\s*roas/.test(question)) return "low_roas";
    if (/no\s*sales|not\s*getting\s*sales/.test(question)) return "no_sales";
    if (/conversion|not\s*converting/.test(question)) return "conversion";
    if (/traffic|visitors/.test(question)) return "traffic";

    /* ---------- GOALS ---------- */
    if (/grow|scale|increase|expand/.test(question)) return "growth";

    /* ---------- MEMORY FALLBACK ---------- */
    if (Array.isArray(memory?.painPoints) && memory.painPoints.length > 0) {
      return safeString(memory.painPoints[0]);
    }

    return "general";
  }

  /* ================= INDUSTRY DETECTION ================= */
  private guessIndustry(question: string, context: any[]): string {
    const q = question;

    /* ---------- DIRECT ---------- */
    if (/ecommerce|store|shop/.test(q)) return "ecommerce";
    if (/real\s*estate|property/.test(q)) return "real_estate";
    if (/travel|tourism/.test(q)) return "travel";
    if (/agency|marketing/.test(q)) return "marketing";

    /* ---------- CONTEXT ---------- */
    const combined = (context || [])
      .map((m) => safeString(m?.content))
      .join(" ");

    if (combined.includes("ecommerce")) return "ecommerce";
    if (combined.includes("real estate")) return "real_estate";
    if (combined.includes("travel")) return "travel";
    if (combined.includes("marketing")) return "marketing";

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
        return "Fix creative fatigue, improve audience targeting, and optimize product page conversion flow";
      }
      if (problem === "no_sales") {
        return "Audit the funnel, fix trust gaps, and align your offer with customer intent";
      }
      if (problem === "conversion") {
        return "Improve landing page UX, optimize checkout flow, and run A/B testing";
      }
      if (problem === "traffic") {
        return "Scale paid ads, SEO, and short-form content distribution";
      }
      if (problem === "growth") {
        return "Combine paid acquisition, CRO, and retention systems to scale efficiently";
      }
    }

    /* ---------- REAL ESTATE ---------- */
    if (industry === "real_estate") {
      if (problem === "low_roas") {
        return "Upgrade ad creatives with high-end visuals and refine luxury audience targeting";
      }
      if (problem === "conversion") {
        return "Use virtual tours and lead qualification funnels to increase buyer intent";
      }
      if (problem === "growth") {
        return "Deploy high-ticket funnels with premium visuals and targeted campaigns";
      }
    }

    /* ---------- TRAVEL ---------- */
    if (industry === "travel") {
      if (problem === "traffic") {
        return "Focus on SEO, destination content, and social media distribution";
      }
      if (problem === "conversion") {
        return "Optimize booking flow and implement retargeting campaigns";
      }
    }

    /* ---------- MARKETING & DEFAULT ---------- */
    return "Use a mix of content marketing, paid acquisition, and conversion optimization to improve results";
  }

  /* ================= DYNAMIC STRATEGY ================= */
  private dynamicStrategy(
    base: string,
    context: { problem: string; industry: string; contextLength: number }
  ): string {

    const { problem, industry, contextLength } = context;

    const templates = [
      `${base}.`,
      `For your ${industry} setup, focus on this: ${base}.`,
      `The main issue is ${problem}. The best move is: ${base}.`,
      `Right now, the highest-impact action is: ${base}.`,
    ];

    return templates[contextLength % templates.length];
  }
}

/* ================= SINGLETON ================= */
export const reasoningEngine = new ReasoningEngine();
