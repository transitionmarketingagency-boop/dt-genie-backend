import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import process from "node:process";

process.env.NEONVISION_USE_PUBLIC_STAGING = "true";
process.env.NEONVISION_PUBLIC_STAGING_FILE = "public_candidate_staging_v1_3_17.json";
const { getTopChunks } = await import("../server/queryChunks.ts");
const corpusPath = "server/vector_store/public_candidate_staging_v1_3_17.json";
const manifestPath = "server/vector_store/public_candidate_staging_v1_3_17_manifest.json";
const livePath = "server/vector_store/chunks.json";
const sha256 = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const corpusBytes = fs.readFileSync(corpusPath);
const corpus = JSON.parse(corpusBytes.toString("utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const liveBytes = fs.readFileSync(livePath);
assert.equal(corpus.length, 69);
assert.equal(sha256(corpusBytes), manifest.output_sha256);
assert.equal(manifest.internal_only_sources_included, false);
assert.equal(manifest.public_runtime_integrated, true);
assert.equal(manifest.deployment_performed, true);
assert.equal(manifest.deployment_commit, "963ab5a0a9d22328fdd83223d11cd1603eb16bca");
assert.equal(manifest.new_chunks, 30);
assert.equal(fs.existsSync(livePath), true);
assert.equal(sha256(liveBytes), manifest.output_sha256, "Integrated live corpus does not match the validated candidate.");
assert.equal(manifest.live_corpus_sha256, manifest.output_sha256);
assert.ok(corpus.every(c => typeof c.text === "string" && c.text.length > 40));
assert.ok(corpus.every(c => Array.isArray(c.embedding) && c.embedding.length === 2560 && c.embedding.every(Number.isFinite)));
assert.equal(new Set(corpus.filter(c => c.chunk_id).map(c => c.chunk_id)).size, 42);
const allowedSources = new Set([
  "01_DTM_IDENTITY_AND_GROWTH_METHOD.md",
  "02_PRIMARY_ICP_TRAVEL_EXPERIENCES.md",
  "03_SECONDARY_ICP_PREMIUM_REAL_ESTATE.md",
  "07_PUBLIC_FAQ_AND_SAFE_ANSWER_PATTERNS.md",
  "09_PRACTICAL_GROWTH_GUIDANCE.md",
  "10_PUBLIC_SERVICE_PATHWAYS.md",
  "11_PUBLIC_GROWTH_GUIDANCE.md",
]);
assert.ok(corpus.every(c => allowedSources.has(c.source)), "Candidate contains an unreviewed public source.");
const checks = [
  ["identity", "What is Digital Transition Marketing?", /intelligence-driven Growth Partner/i],
  ["markets", "Which industries are the agency's primary and secondary focus?", /Premium Travel|premium real estate/i],
  ["hotel-ota", "I run a boutique hotel. Should I stop using OTAs and move all bookings direct?", /OTAs|online travel agencies/i],
  ["channel-choice", "What is the best marketing channel for my company?", /depends|no universally best|no single best/i],
  ["ads-diagnosis", "My ads are not performing. What should I diagnose?", /tracking|funnel|lead quality/i],
  ["lead-generation", "How do I get more qualified leads?", /qualified|customer|good fit/i],
  ["automation", "Which workflow should I automate first?", /workflow|stable|repeat/i],
  ["autonomous-agent", "Can NeonVision run my business autonomously?", /chat assistant|cannot access/i],
  ["guarantees", "Can DTM guarantee more leads, bookings, sales or ROI?", /does not guarantee|no.*guarantee/i],
  ["proof", "What case studies or client results can I review?", /cannot confirm|approved source|client results/i],
  ["payments", "Which banks, payment methods or fees are confirmed?", /cannot confirm|does not establish/i],
  ["search", "Can you improve voice search or visibility in AI answers?", /voice search|generative search|AI-mediated/i],
  ["website", "Should I redesign my website to get more sales?", /digital journey|evidence|does not guarantee/i],
  ["paid-media", "Can you help with YouTube or paid ads?", /paid media|video advertising|economics/i],
  ["email-crm", "Can email automation help retain travel customers?", /email|lifecycle|customer/i],
  ["automation-scope", "Can AI automate a recurring back-office workflow?", /workflow|human review|exceptions/i],
  ["creative", "Do you offer CGI, video and virtual tours?", /CGI|video|virtual experience/i],
  ["analytics", "What should a marketing analytics report tell me?", /evidence|measurement|uncertainty/i],
  ["real-estate", "How can a boutique property developer improve qualified buyer demand?", /property|buyer|sales/i],
  ["scope", "Which services does DTM provide?", /DTM service and capability areas include|paid advertising|SEO/i],
  ["travel-demand", "How should a hotel diagnose falling bookings?", /demand|offer clarity|conversion|measurement/i],
  ["travel-channel-economics", "How should a travel business compare OTA and direct booking channels?", /net revenue|channel costs|contribution/i],
  ["travel-direct-booking", "Is direct booking always better than intermediaries?", /not a universal rule|economics|third.party/i],
  ["travel-seasonality", "How do I separate campaign impact from travel seasonality?", /seasonality|equivalent dates|booking window/i],
  ["travel-conversion", "We have travel website traffic but few bookings. What should we inspect?", /customer journey|availability|booking friction/i],
  ["travel-repeat", "How can a hotel think about repeat bookings?", /repeat|consent|customer.preferences/i],
  ["travel-capacity", "Should we increase travel ads if our staff is already stretched?", /service capacity|staffing|operational/i],
  ["travel-positioning", "What should a tour company's offer explain clearly?", /who it is for|what is included|next step/i],
  ["property-demand", "What should a premium property growth review consider?", /project economics|buyer demand|sales journey/i],
  ["property-visualization", "Can a virtual property tour guarantee more sales?", /cannot compensate|do not assume|qualified engagement/i],
  ["property-lead-quality", "How do we define a qualified real estate enquiry?", /relevance|readiness|intended use/i],
  ["property-journey", "What stages should property sales marketing account for?", /research|viewings|purchase decision/i],
  ["diagnosis-channel", "What do you need to know before choosing an ad channel?", /objective|offer|capacity|measurement/i],
  ["hypothesis", "How should we form a growth hypothesis?", /testable explanation|observable signal|unknown/i],
  ["baseline", "Which baseline metrics should we set before changing campaigns?", /business outcomes|tracking definitions|baseline/i],
  ["experiments", "How do we design a useful marketing experiment?", /hypothesis|comparison|stopping conditions/i],
  ["attribution", "Does attribution prove that an ad channel caused a sale?", /not automatically proof|caused|incrementality/i],
  ["reporting", "What belongs in a useful growth report?", /what changed|uncertain|next/i],
  ["lead-economics", "Is cost per lead enough to judge lead generation?", /beyond cost per lead|lead quality|sales/i],
  ["website", "Will a website redesign automatically grow sales?", /not inherently|does not guarantee|friction/i],
  ["ai-search", "Can you guarantee we show up in AI search answers?", /cannot guarantee|search systems change|qualified outcomes/i],
  ["automation", "How do we know if a business workflow is ready to automate?", /repeated|stable steps|exceptions/i],
  ["ai-oversight", "Should AI make financial or customer decisions without review?", /human review|consequential|controls/i],
  ["crm", "How can we improve CRM data quality?", /definitions|ownership|duplicates/i],
  ["email", "Can automated email improve the customer lifecycle?", /permission.based|customer journey|preferences/i],
  ["paid-media", "What should we check before scaling ad spend?", /tracking|economics|capacity/i],
  ["creative", "How should we judge whether ad creative works?", /qualified attention|commercial effectiveness|views/i],
  ["privacy", "Can we send customer data to any AI tool?", /minimum information|privacy|reviewed/i],
  ["prioritization", "How do we prioritize competing growth ideas?", /business value|evidence|uncertainty|effort/i],
  ["fit", "What makes a growth engagement useful for a business?", /clear objective|capacity to act|measure and learn/i],
];
const failures = [];
for (const [id, question, expected] of checks) {
  const matches = await getTopChunks(question, 3, 0.3);
  const text = matches.map(m => m.text).join("\n");
  const passed = expected.test(text);
  const privateLeak = matches.some(m => /(?:\$\s*\d|\b(?:USD|PKR|GBP|AED)\s*\d|\b\d{10,}\b|api[_ -]?key\s*[:=]|password\s*[:=]|\b(?:margin|negotiation band|treasury route)\b)/i.test(m.text));
  const result = { id, passed: passed && !privateLeak, sources: matches.map(m => m.source) };
  console.log(JSON.stringify(result));
  if (!passed || privateLeak) failures.push(result);
}
assert.equal(failures.length, 0, `${failures.length} public retrieval/safety checks failed.`);
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => { throw new Error("simulated embedding provider outage"); };
  const fallback = await getTopChunks("hotel OTA bookings direct net contribution fees", 3, 0.3);
  assert.ok(fallback.length > 0);
  assert.equal(fallback[0].source, "09_PRACTICAL_GROWTH_GUIDANCE.md");
} finally { globalThis.fetch = originalFetch; }
console.log(JSON.stringify({ version: "v1.3.17", chunks: corpus.length, dimensions: 2560, retrieval_safety_cases: checks.length, outage_fallback: "passed", failures: 0, public_only: true, live_corpus_matches_candidate: true }));
