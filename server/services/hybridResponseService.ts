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
