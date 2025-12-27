export type ChunkRule = {
  maxTokens: number;
  overlap: number;
  purpose: string;
};

export const chunkRules = {
  persona: {
    maxTokens: 400,
    overlap: 50,
    purpose: "Define how NeonVision should behave, speak, and think"
  },

  website: {
    maxTokens: 600,
    overlap: 80,
    purpose: "Explain company, offerings, positioning, and credibility"
  },

  services: {
    maxTokens: 500,
    overlap: 60,
    purpose: "Describe individual services clearly and independently"
  },

  sales: {
    maxTokens: 350,
    overlap: 40,
    purpose: "Persuasive, objection-handling, conversion-focused responses"
  },

  marketing: {
    maxTokens: 700,
    overlap: 100,
    purpose: "High-level strategy, planning, frameworks, consulting"
  },

  faqs: {
    maxTokens: 300,
    overlap: 30,
    purpose: "Direct, precise answers to common questions"
  }
};
