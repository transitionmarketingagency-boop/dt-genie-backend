import { memoryService } from "./memoryService.js";
import { hybridResponseService } from "./generateHybridResponse.js";
import { getFusedChunks } from "./intentVectorFusion.js";
import { detectIntents } from "./serviceDetector.js";

/* ================= TYPES ================= */
export type ReasoningData = {
  problem: string;
  industry: string;
  strategy: string;
  recentMessages: { role: string; content: string }[];
  services: string[];
  fusedChunks: { text: string; source: string; fusionScore: number; intent: string }[];
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
  /* -------------------- MAIN ANALYSIS -------------------- */
  async analyze(sessionId: string, userQuestion: string): Promise<ReasoningData> {
    const [recentMessagesRaw, strategicMemoryRaw] = await Promise.all([
      memoryService.getRecentContext(sessionId).catch(() => []),
      memoryService.getStrategicMemory(sessionId).catch(() => ({})),
    ]);

    const strategicMemory: StrategicMemory = strategicMemoryRaw || {};
    const question = safeString(userQuestion);

    // ---------- PROBLEM ----------
    const problem = this.extractProblem(question, strategicMemory);

    // ---------- INDUSTRY ----------
    const industry = strategicMemory.industry || this.guessIndustry(question, recentMessagesRaw);

    // ---------- SERVICES DETECTION ----------
    let detectedServices: string[] = [];
    try {
      const hybridServices = await hybridResponseService.detectServices(userQuestion);
      detectedServices =
        hybridServices && hybridServices.length
          ? hybridServices
          : strategicMemory.servicesDiscussed || [];
    } catch (err) {
      detectedServices = strategicMemory.servicesDiscussed || [];
    }

    // ---------- FUSED VECTOR CHUNKS ----------
    const fusedChunks = (await getFusedChunks(userQuestion, 5).catch(() => [])) || [];

    // ---------- CONTEXT ----------
    const recentMessages = (recentMessagesRaw || []).map((m: any) => ({
      role: typeof m?.role === "string" ? m.role : "user",
      content: safeString(m?.content),
    }));

    // ---------- BASE STRATEGY ----------
    const baseStrategy = this.suggestStrategy(question, industry, problem, detectedServices, fusedChunks);

    // ---------- DYNAMIC STRATEGY ----------
    const strategy = this.dynamicStrategy(baseStrategy, {
      problem,
      industry,
      contextLength: recentMessages.length,
      services: detectedServices,
      fusedChunks,
    });

    // ---------- MEMORY UPDATE ----------
    await memoryService.updateStrategicMemory(sessionId, {
      lastUserProblem: problem,
      lastDetectedServices: detectedServices,
    });

    return { problem, industry, strategy, recentMessages, services: detectedServices, fusedChunks };
  }

  /* ================= PROBLEM DETECTION ================= */
  private extractProblem(question: string, memory: StrategicMemory): string {
    if (!question) return "general";

    const problemMap: Record<string, string> = {
      "low roas": "low_roas",
      "bad roas": "low_roas",
      "no sales": "no_sales",
      "not getting sales": "no_sales",
      conversion: "conversion",
      "not converting": "conversion",
      traffic: "traffic",
      visitors: "traffic",
      grow: "growth",
      scale: "growth",
      increase: "growth",
      expand: "growth",
    };

    for (const pattern in problemMap) {
      if (new RegExp(pattern, "i").test(question)) return problemMap[pattern];
    }

    // Fallback to memory
    if (Array.isArray(memory?.painPoints) && memory.painPoints.length > 0) {
      return safeString(memory.painPoints[0]);
    }

    return "general";
  }

  /* ================= INDUSTRY DETECTION ================= */
  private guessIndustry(question: string, context: any[]): string {
    const q = question;

    const industryMap: Record<string, string> = {
      ecommerce: "ecommerce",
      store: "ecommerce",
      shop: "ecommerce",
      "real estate": "real_estate",
      property: "real_estate",
      travel: "travel",
      tourism: "travel",
      agency: "marketing",
      marketing: "marketing",
    };

    for (const keyword in industryMap) {
      if (q.includes(keyword)) return industryMap[keyword];
    }

    const combined = (context || []).map((m) => safeString(m?.content)).join(" ");
    for (const keyword in industryMap) {
      if (combined.includes(keyword)) return industryMap[keyword];
    }

    return "general";
  }

  /* ================= STRATEGY ENGINE ================= */
  private suggestStrategy(
    question: string,
    industry: string,
    problem: string,
    services: string[],
    fusedChunks: { text: string; source: string; fusionScore: number; intent: string }[]
  ): string {
    const serviceList = services.length ? services.join(", ") : "[detected services]";

    const chunkInsights = fusedChunks?.length
      ? fusedChunks.slice(0, 3).map((c) => `${c.intent}: ${c.text}`).join(" | ")
      : "";

    const templates: Record<string, Record<string, string>> = {
      ecommerce: {
        low_roas: `Refresh creative assets, optimize product pages, and improve targeting for ${serviceList}. Insights: ${chunkInsights}`,
        no_sales: `Audit your funnel and align offers to customer intent for ${serviceList}. Insights: ${chunkInsights}`,
        conversion: `Optimize checkout and run A/B tests to boost ${serviceList}. Insights: ${chunkInsights}`,
        traffic: `Scale paid ads, SEO, and short-form content for ${serviceList}. Insights: ${chunkInsights}`,
        growth: `Combine paid acquisition, CRO, and retention systems for ${serviceList}. Insights: ${chunkInsights}`,
      },
      real_estate: {
        low_roas: `Upgrade ad creatives with premium visuals and refine audience targeting for ${serviceList}. Insights: ${chunkInsights}`,
        no_sales: `Implement virtual tours, lead scoring, and qualification funnels for ${serviceList}. Insights: ${chunkInsights}`,
        conversion: `Enhance buyer intent with 360 tours and retargeting funnels for ${serviceList}. Insights: ${chunkInsights}`,
        growth: `Deploy high-ticket funnels with premium visuals and targeted campaigns for ${serviceList}. Insights: ${chunkInsights}`,
      },
      travel: {
        traffic: `Focus on SEO, destination content, and social media distribution for ${serviceList}. Insights: ${chunkInsights}`,
        conversion: `Optimize booking flows and implement retargeting campaigns for ${serviceList}. Insights: ${chunkInsights}`,
        growth: `Use multi-channel campaigns with personalized offers to increase bookings for ${serviceList}. Insights: ${chunkInsights}`,
      },
      marketing: {
        growth: `Improve acquisition, retention, and automation systems for ${serviceList}. Insights: ${chunkInsights}`,
      },
      general: {
        growth: `Focus on high-impact bottlenecks and optimize your ${serviceList} workflow. Insights: ${chunkInsights}`,
      },
    };

    return templates[industry]?.[problem] || templates[industry]?.growth || templates.general.growth;
  }

  /* ================= DYNAMIC STRATEGY ================= */
  private dynamicStrategy(
    base: string,
    context: { problem: string; industry: string; contextLength: number; services: string[]; fusedChunks: any[] }
  ): string {
    const { problem, industry, contextLength, services, fusedChunks } = context;

    const templates = [
      `${base}.`,
      `For your ${industry} setup with services (${services.join(", ")}), focus on this: ${base}.`,
      `The main issue is ${problem}. Key insights: ${fusedChunks?.slice(0, 2).map((c) => c.text).join(" | ")}. Recommended move: ${base}.`,
      `Right now, the highest-impact action is: ${base}.`,
    ];

    return templates[contextLength % templates.length];
  }
}

/* ================= SINGLETON ================= */
export const reasoningEngine = new ReasoningEngine();
