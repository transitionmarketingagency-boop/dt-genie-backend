// server/services/reasoningEngine.ts
import { memoryService } from "./memoryService.js";

/* -------- Reasoning Engine -------- */
export class ReasoningEngine {
  async analyze(sessionId: string, userQuestion: string) {
    const recentContext = await memoryService.getRecentContext(sessionId);
    const strategicMemory = await memoryService.getStrategicMemory(sessionId);

    // Simple heuristic-based reasoning steps
    const reasoning: any = {};

    // Problem identification
    reasoning.problem = this.extractProblem(userQuestion);

    // Industry context
    reasoning.industry = strategicMemory.industry ?? this.guessIndustry(userQuestion);

    // Recommended strategy
    reasoning.strategy = this.suggestStrategy(userQuestion, reasoning.industry);

    // Include user recent context for richer responses
    reasoning.recentMessages = recentContext.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    return reasoning;
  }

  /* Dummy problem extractor */
  private extractProblem(question: string): string {
    const q = question.toLowerCase();
    if (q.includes("grow") || q.includes("increase") || q.includes("sales")) return "growth";
    if (q.includes("traffic") || q.includes("visitors")) return "traffic";
    if (q.includes("conversion") || q.includes("optimize")) return "conversion";
    return "general";
  }

  /* Guess industry from question */
  private guessIndustry(question: string): string {
    const q = question.toLowerCase();
    if (q.includes("ecommerce") || q.includes("store")) return "ecommerce";
    if (q.includes("real estate") || q.includes("property")) return "real estate";
    if (q.includes("travel") || q.includes("tourism")) return "travel";
    return "general";
  }

  /* Suggest strategy based on problem + industry */
  private suggestStrategy(question: string, industry: string): string {
    const problem = this.extractProblem(question);

    if (industry === "ecommerce") {
      if (problem === "growth") return "paid traffic + conversion optimization";
      if (problem === "traffic") return "SEO + social ads";
      if (problem === "conversion") return "funnel optimization + A/B testing";
    }

    if (industry === "real estate") {
      if (problem === "growth") return "high-quality CGI tours + targeted ads";
      if (problem === "traffic") return "local SEO + Google Ads";
      if (problem === "conversion") return "virtual tours + lead nurturing";
    }

    return "content + marketing strategy";
  }
}

/* -------- Singleton -------- */
export const reasoningEngine = new ReasoningEngine();
