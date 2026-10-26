/**
 * Deterministic answers for public questions where an unsupported claim would
 * create a commercial, privacy, or trust problem. Keep these grounded in the
 * approved public corpus and do not imply an unverified human handoff.
 */
export function getApprovedPublicAnswer(message: string): string {
  const question = (message || "").trim().toLowerCase();

  if (/\b(case stud(?:y|ies)|client results?|testimonials?|client revenue|revenue figures|current clients?)\b/.test(question)) {
    return "I can’t confirm which client examples, results, or testimonials are approved for sharing. I can explain DTM’s approach, but I shouldn’t present demonstrations as client results.";
  }

  if (/\b(payment methods?|payment providers?|banks?|bank routes?|bank details|fees|billing systems?|payment rails?)\b/.test(question)) {
    return "I can’t confirm current payment methods, providers, fees, or bank routes from approved public information.";
  }

  if (/\b(security|certifications?|certified|soc ?2|iso\s*\d|hipaa|gdpr|compliance status)\b/.test(question)) {
    return "The approved public information does not confirm a specific security certification or claim, so I can’t verify one.";
  }

  if (/\b(ai models?|integrations?|current tools?|supported tools?|technology stack)\b/.test(question)) {
    return "The approved public information does not confirm which AI models, integrations, or current tools are supported. Which workflow or platform are you asking about?";
  }

  if (/\b(internal (?:pricing|sales|qualification|scoring|prospecting|commercial)|qualification score|scoring threshold|prospecting triggers?|sales playbook|margins?)\b/.test(question)) {
    return "I can’t disclose DTM’s internal commercial or sales procedures. I can explain the public approach: DTM diagnoses the growth constraint, weighs evidence and business economics, then recommends a suitable next step.";
  }

  if (/\b(?:customer|client|personal|sensitive|identifiable) (?:data|records|information)\b/.test(question) && /\b(?:ai|model|provider|tool|upload|share|send|use)\b/.test(question)) {
    return "Before sharing customer data with an AI tool, confirm what information is needed, how it will be used, the provider’s retention and security terms, access controls, and applicable requirements. Use the minimum necessary data. If the information is sensitive or identifiable, pause for qualified review when the rules or safeguards are unclear.";
  }

  const performanceCostQuestion =
    /\bcost per (?:lead|click|acquisition|conversion|booking|customer|sale|enquir\w*|impression)\b/.test(question) &&
    !/\b(?:dtm|you|your|agency)\b.{0,35}\b(?:charge|price|pricing|quote|bill|fee)\b/.test(question);

  if (performanceCostQuestion && /\b(?:why|enough|assess|judge|compare|measure|what does|how should|how do)\b/.test(question)) {
    return "Cost per lead is an acquisition-efficiency measure, not proof of lead quality or sales value. Assess whether enquiries fit the intended customer, progress to conversations and sales, what those outcomes contribute, and whether the business can serve them. Compare consistent periods and account for changes in audience, offer, channel, and tracking.";
  }

  if (/\b(?:seasonality|seasonal(?: demand)?)\b/.test(question) && /\b(?:campaign|advertis\w*|marketing)\b/.test(question)) {
    return "Compare equivalent periods where possible and account for availability, booking window, cancellations, and changes to the offer or inventory. Review enquiries and bookings against a reliable baseline. A before-and-after comparison alone cannot isolate a campaign’s effect; where feasible, use a suitable comparison or holdout and note its limits. If the available data cannot separate seasonal demand from campaign impact, state that uncertainty rather than assigning credit.";
  }

  if (/\b(pric(?:e|ing)|costs?|how much|fixed fee|packages?|quotes?|rates?|retainers?|margins?)\b/.test(question)) {
    return "I can’t confirm a fixed price from approved public information. Investment depends on scope and business context; what outcome are you looking to achieve?";
  }

  if (/\b(?:guarantee|guaranteed|promise(?:s|d)?).{0,50}\b(?:leads?|bookings?|sales|roi|results?|growth|increases?)\b|\b(?:leads?|bookings?|sales|roi|results?|growth|increases?).{0,50}\b(?:guarantee|guaranteed|promise)\b/.test(question)) {
    return "No. DTM does not guarantee leads, bookings, sales, or ROI. We work from evidence, define appropriate measures, test hypotheses where feasible, and use the results to guide decisions.";
  }

  if (/\b(?:ota|otas|online travel agencies|book(?:ing)? direct|direct bookings?|shift(?:ing)? to direct)\b/.test(question)) {
    return "Don’t stop using OTAs without evidence that direct demand can replace those bookings profitably. Compare each channel’s net contribution after costs, whether demand is incremental, seasonality, capacity, and repeat-booking potential. Keep channels that contribute profitably while testing improvements to direct discovery against a baseline; the right mix depends on your numbers. What share of your bookings and contribution currently comes from each channel?";
  }

  if (/\b(?:website visits?|website traffic|site traffic)\b/.test(question) && /\b(?:few|low|limited|not enough)\b.{0,35}\b(?:enquir\w*|leads?|conversions?|sales)\b/.test(question)) {
    return "High visits with few enquiries do not identify the cause by themselves. Verify measurement and review visitor fit by source, the offer and positioning, landing-page conversion, enquiry friction, follow-up, and progression to sale. Find the observed drop-off and compare a representative period before choosing a new channel. Which source sends most visits, and where do prospects currently drop out?";
  }

  if (/\b(?:increas\w*|rais\w*|scal\w*)\b.{0,35}\b(?:marketing|ad|advertising|budget|spend)\b|\b(?:marketing|advertising|ad) budget\b/.test(question)) {
    return "Before increasing spend, review a reliable baseline, tracking, qualified-lead and sale conversion, channel contribution, seasonality, attribution limits, and capacity to serve added demand. Use evidence to estimate whether more spend is likely to add profitable demand, then test a measured change before scaling. What result and baseline are you using to judge the increase?";
  }

  if (/\b(?:growth constraint|growth bottleneck|address first|which constraint|choose an intervention|before choosing an intervention)\b/.test(question)) {
    return "Start by clarifying the business outcome and reviewing the evidence across demand, conversion, customer economics, delivery capacity, and measurement. Identify where the largest supported constraint sits, check what it would take to change it, then prioritize a testable intervention against the expected impact, cost, and risk. What outcome matters most, and which measures do you already trust?";
  }

  if (/\b(?:best marketing channel|best channel|which marketing channel|which channel should)\b/.test(question)) {
    return "There isn’t one best channel for every business. Compare options against your target customer, offer, customer economics, buying journey, ability to serve demand, and what you can measure. Judge qualified opportunities and contribution, not reach or clicks alone; test before scaling when evidence is limited. What do you sell, and who are you trying to reach?";
  }

  if (/\b(?:ads?|advertising)\b/.test(question) && /\b(?:fix|improv\w*|perform\w*|working|results?|wast\w*|cost|lead quality|convert\w*|scale)\b/.test(question)) {
    return "First verify tracking, then find where the funnel is breaking: audience and offer fit, creative, landing-page conversion, lead quality and follow-up, sales conversion, or contribution after acquisition costs. A low cost per lead does not prove the leads are valuable. Change a small number of variables at a time, and don’t increase spend until the economics and capacity support it. Which metric is weakest right now?";
  }

  if (/\b(?:lead generation|more leads?|qualified leads?|lead quality|generate leads?)\b/.test(question)) {
    return "Define what makes an enquiry qualified, then inspect the offer, how suitable customers discover it, the path to enquiry, follow-up, and conversion to sale. Measure qualified enquiries through to sales and their economics, not just form fills, and confirm you can serve more demand. What do you sell, who is the target customer, and where do enquiries come from today?";
  }

  if (/\b(?:which|what|how|should i)\b.{0,45}\b(?:automate|automation)\b|\b(?:automate|automation)\b.{0,45}\b(?:business|workflow|task|process)\b/.test(question)) {
    return "Start with a repeated, stable workflow whose steps and exceptions are clear. Map the current process and measure its time, errors, and maintenance cost before automating it; add a fallback and human review for consequential actions or sensitive data. What recurring task takes the most time, and what steps or tools does it involve?";
  }

  if (/\b(what types? of businesses|which industries|what industries|who do you help|who does dtm help|markets do you focus on|industry focus)\b/.test(question)) {
    return "DTM’s primary market focus is Premium Travel & Experiences, with Boutique/Premium Real Estate as a secondary market. These are starting markets rather than permanent limits; suitability depends on the business economics, growth opportunity, operating capacity, and willingness to measure and improve.";
  }

  if (/\b(what is digital transition marketing|what does dtm do|who is dtm|what is dtm)\b/.test(question)) {
    return "Digital Transition Marketing (DTM) is an intelligence-driven Growth Partner. DTM helps businesses diagnose where growth is constrained, identify valuable opportunities, and choose suitable strategic, creative, acquisition, customer-experience, measurement, or technology interventions. The work is evidence-led; the specific solution follows the diagnosis.";
  }

  if (/\bcan\b.{0,24}\b(?:neon ?vision|you)\b.{0,60}\b(?:autonomous agent|agent|run (?:my|your) business|manage (?:my|your) business|execute (?:work|tasks)|access (?:my|your) accounts|change (?:my|your) (?:ads|campaigns))\b/.test(question)) {
    return "NeonVision is a chat assistant. It can help reason through information you share and draft ideas or next steps, but it cannot access your business accounts or execute work from this chat. Actions require the relevant tools and permissions, with human review for consequential work.";
  }

  return "";
}

export function getQuickActionFollowUp(message: string): string {
  const normalized = (message || "").trim().toLowerCase().replace(/[.!?]+$/, "");
  if (/^(fix|improve) (my )?(ads|advertising)$/.test(normalized)) {
    return "Which ad platform are you using, and what needs attention most: cost per lead, lead quality, conversions, or the creative?";
  }
  if (/^(get|generate) (more )?leads$/.test(normalized)) {
    return "What do you sell, who is the customer you want to reach, and where do your leads come from today?";
  }
  if (/^(automate|improve automation) (my )?business$/.test(normalized)) {
    return "Which recurring task takes the most time right now, and what tools or steps are involved?";
  }
  return "";
}
