import { memoryService } from "./memoryService.js";
import { hybridResponseService } from "./generateHybridResponse.js";
import { getFusedChunks } from "./intentVectorFusion.js";

/* ================= TYPES ================= */
export type ReasoningData = {
  problem: string;
  industry: string;
  strategy: string;
  recentMessages: { role: string; content: string }[];
  services: string[];
};

/* ================= STRATEGIC MEMORY TYPE ================= */
export type StrategicMemory = {
  industry?: string;
  servicesDiscussed?: string[];
  painPoints?: string[];
  goals?: string[];
  lastUserProblem?: string;
  lastDetectedServices?: string[];
  [key: string]: any;
};

/* ================= UTILS ================= */
function safeString(val: any): string {
  if (!val || typeof val !== "string") return "";
  return val.toLowerCase().trim();
}

/* ================= REASONING ENGINE ================= */
export class ReasoningEngine {
  async analyze(sessionId: string, userQuestion: string): Promise<ReasoningData> {
    const [recentMessagesRaw, strategicMemoryRaw] = await Promise.all([
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
      this.guessIndustry(question, recentMessagesRaw);

    /* ---------- SERVICES (LIMITED + CLEAN) ---------- */
    let detectedServices: string[] = [];
    try {
      const hybridServices = await hybridResponseService.detectServices(userQuestion);

      detectedServices =
        hybridServices && hybridServices.length
          ? hybridServices
          : strategicMemory.servicesDiscussed || [];
    } catch {
      detectedServices = strategicMemory.servicesDiscussed || [];
    }

    // ✅ HARD LIMIT (CRITICAL FIX)
    detectedServices = [...new Set(detectedServices)].slice(0, 2);

    /* ---------- CLEAN CONTEXT ---------- */
    const recentMessages = (recentMessagesRaw || [])
      .slice(-3) // ✅ LIMIT CONTEXT
      .map((m: any) => ({
        role: typeof m?.role === "string" ? m.role : "user",
        content: safeString(m?.content),
      }));

    /* ---------- SAFE VECTOR USAGE (NO RAW LEAK) ---------- */
    let insightHint = "";
    try {
      const chunks = await getFusedChunks(userQuestion, 3);

      if (chunks?.length) {
        insightHint = chunks
          .slice(0, 2) // ✅ HARD LIMIT
          .map((c) => safeString(c.text).slice(0, 100)) // ✅ NO RAW JSON
          .join(" ");
      }
    } catch {
      insightHint = "";
    }

    /* ---------- STRATEGY ---------- */
    const strategy = this.buildStrategy({
      problem,
      industry,
      services: detectedServices,
      insightHint,
    });

    /* ---------- MEMORY UPDATE ---------- */
    await memoryService.updateStrategicMemory(sessionId, {
      lastUserProblem: problem,
      lastDetectedServices: detectedServices,
    });

    return {
      problem,
      industry,
      strategy,
      recentMessages,
      services: detectedServices,
    };
  }

  /* ================= PROBLEM DETECTION ================= */
  private extractProblem(question: string, memory: StrategicMemory): string {
    if (!question) return "general";

    if (/low\s*roas|bad\s*roas/.test(question)) return "low_roas";
    if (/no\s*sales|not\s*getting\s*sales/.test(question)) return "no_sales";
    if (/conversion|not\s*converting/.test(question)) return "conversion";
    if (/traffic|visitors/.test(question)) return "traffic";
    if (/grow|scale|increase|expand/.test(question)) return "growth";

    if (Array.isArray(memory?.painPoints) && memory.painPoints.length > 0) {
      return safeString(memory.painPoints[0]);
    }

    return "general";
  }

  /* ================= INDUSTRY DETECTION ================= */
  private guessIndustry(question: string, context: any[]): string {
    if (/ecommerce|store|shop/.test(question)) return "ecommerce";
    if (/real\s*estate|property/.test(question)) return "real_estate";
    if (/travel|tourism/.test(question)) return "travel";
    if (/agency|marketing/.test(question)) return "marketing";

    const combined = (context || [])
      .map((m) => safeString(m?.content))
      .join(" ");

    if (combined.includes("ecommerce")) return "ecommerce";
    if (combined.includes("real estate")) return "real_estate";
    if (combined.includes("travel")) return "travel";
    if (combined.includes("marketing")) return "marketing";

    return "general";
  }

  /* ================= STRATEGY BUILDER (FIXED CORE) ================= */
  private buildStrategy({
    problem,
    industry,
    services,
    insightHint,
  }: {
    problem: string;
    industry: string;
    services: string[];
    insightHint: string;
  }): string {
    const svc = services.length ? services.join(", ") : "your marketing system";

    /* ---------- CORE STRATEGY (NO TEMPLATE LOOP) ---------- */
    if (problem === "conversion") {
      return `You're getting traffic but not converting. Focus on fixing your offer, landing page clarity, and trust signals. Improve your ${svc} by aligning messaging with buyer intent.`;
    }

    if (problem === "no_sales") {
      return `This is a funnel breakdown. Either targeting is wrong or your offer isn't compelling. Rework your ${svc} to match customer pain points and buying triggers.`;
    }

    if (problem === "low_roas") {
      return `Low ROAS usually means poor creative or wrong audience. Optimize your ${svc} by testing new creatives and refining targeting segments.`;
    }

    if (problem === "traffic") {
      return `You need stronger acquisition channels. Scale your ${svc} using paid ads, SEO, and high-performing content distribution.`;
    }

    /* ---------- DEFAULT ---------- */
    return `Focus on identifying your biggest bottleneck and optimize your ${svc}. Start with the highest-impact area affecting growth.`;
  }
}

/* ================= SINGLETON ================= */
export const reasoningEngine = new ReasoningEngine();
