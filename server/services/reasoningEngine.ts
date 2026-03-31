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
  [key: string]: any;
};

/* ================= Reasoning Engine ================= */
export class ReasoningEngine {
  /* -------------------- Main analyze -------------------- */
  async analyze(sessionId: string, userQuestion: string): Promise<ReasoningData> {
    // Fetch memory in parallel
    const [recentContextRaw, strategicMemoryRaw] = await Promise.all([
      memoryService.getRecentContext(sessionId).catch(() => []),
      memoryService.getStrategicMemory(sessionId).catch(() => ({} as StrategicMemory)),
    ]);

    const strategicMemory: StrategicMemory = strategicMemoryRaw || {};

    // Extract problem
    const problem = this.extractProblem(userQuestion);

    // Determine industry
    const industry = strategicMemory.industry ?? this.guessIndustry(userQuestion);

    // Suggest strategy
    const strategy = this.suggestStrategy(userQuestion, industry);

    // Process recent messages dynamically
    const recentMessages = recentContextRaw.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    // Dynamic fallback: cycle template based on recent message count for variation
    const dynamicStrategy = this.dynamicTemplate(strategy, recentMessages.length);

    return {
      problem,
      industry,
      strategy: dynamicStrategy,
      recentMessages,
    };
  }

  /* -------------------- Problem Extractor -------------------- */
  private extractProblem(question: string): string {
    const q = question.toLowerCase();
    if (q.includes("grow") || q.includes("increase") || q.includes("sales")) return "growth";
    if (q.includes("traffic") || q.includes("visitors")) return "traffic";
    if (q.includes("conversion") || q.includes("optimize")) return "conversion";
    return "general";
  }

  /* -------------------- Industry Guesser -------------------- */
  private guessIndustry(question: string): string {
    const q = question.toLowerCase();
    if (q.includes("ecommerce") || q.includes("store")) return "ecommerce";
    if (q.includes("real estate") || q.includes("property")) return "real estate";
    if (q.includes("travel") || q.includes("tourism")) return "travel";
    return "general";
  }

  /* -------------------- Strategy Suggester -------------------- */
  private suggestStrategy(question: string, industry: string): string {
    const problem = this.extractProblem(question);

    if (industry === "ecommerce") {
      if (problem === "growth") return "Paid traffic + conversion optimization";
      if (problem === "traffic") return "SEO + social ads";
      if (problem === "conversion") return "Funnel optimization + A/B testing";
    }

    if (industry === "real estate") {
      if (problem === "growth") return "High-quality CGI tours + targeted ads";
      if (problem === "traffic") return "Local SEO + Google Ads";
      if (problem === "conversion") return "Virtual tours + lead nurturing";
    }

    if (industry === "travel") {
      if (problem === "growth") return "Partnership campaigns + targeted marketing";
      if (problem === "traffic") return "SEO + social media promotions";
      if (problem === "conversion") return "Booking funnel optimization + retargeting ads";
    }

    return "Content marketing + strategy consulting";
  }

  /* -------------------- Dynamic Template for Variation -------------------- */
  private dynamicTemplate(baseStrategy: string, contextLength: number): string {
    const templates = [
      baseStrategy,
      `Recommended approach: ${baseStrategy}`,
      `Suggested plan: ${baseStrategy}`,
      `Consider implementing: ${baseStrategy}`,
    ];
    // Rotate based on recent context length
    return templates[contextLength % templates.length];
  }
}

/* ================= Singleton ================= */
export const reasoningEngine = new ReasoningEngine();
