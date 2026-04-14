export const hybridResponseService = {
  detectServices: (message: string): string[] => {
    if (typeof message !== "string" || !message.trim()) return [];

    const lowered = message.toLowerCase();
    const servicesSet = new Set<string>();

    const mappings: { regex: RegExp; service: string }[] = [
      { regex: /voice|vso|position zero|featured snippets/, service: "Voice Search Optimization (VSO)" },
      { regex: /email|automation|klaviyo/, service: "AI-Powered Email Marketing" },
      { regex: /youtube|video funnel|ad domination/, service: "AI-Powered YouTube Ad Domination" },
      { regex: /website|web design|seo|core web vitals/, service: "AI-Powered Website Design" },
      { regex: /360 tour|virtual tour|nerf/, service: "AI Virtual Tours" },
      { regex: /performance marketing|ad warfare|bidding/, service: "AI-Powered Ad Warfare (Performance Marketing)" },
      { regex: /ai agents|automation|workflow/, service: "AI Business Automation & AI Agents" },
      { regex: /music|audio|mixing|mastering/, service: "Next-Level Music Production" },
      { regex: /cgi|immersive|3d animation/, service: "Immersive CGI Marketing" },
      { regex: /video production|voiceover/, service: "AI Video and Audio Production" },
      { regex: /content|blog|script/, service: "AI-Optimized Content" },
      { regex: /social|linkedin|reels/, service: "AI-Powered Social Domination" },
      { regex: /geo|ai seo|generative engine/, service: "AI Search Domination (GEO & AI SEO)" },
      { regex: /predictive analytics|sentiment analysis/, service: "AI Predictive Analytics" },
    ];

    for (const { regex, service } of mappings) {
      if (regex.test(lowered)) {
        servicesSet.add(service);
      }
    }

    return Array.from(servicesSet);
  },
};
