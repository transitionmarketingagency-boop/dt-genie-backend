import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import process from "node:process";

process.env.NEONVISION_USE_PUBLIC_STAGING = "true";
process.env.NEONVISION_PUBLIC_STAGING_FILE = "public_candidate_staging_v1_3_16.json";
const { getTopChunks } = await import("../server/queryChunks.ts");
const corpusPath = "server/vector_store/public_candidate_staging_v1_3_16.json";
const manifestPath = "server/vector_store/public_candidate_staging_v1_3_16_manifest.json";
const livePath = "server/vector_store/chunks.json";
const sha256 = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const corpusBytes = fs.readFileSync(corpusPath);
const corpus = JSON.parse(corpusBytes.toString("utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const liveBytes = fs.readFileSync(livePath);
assert.equal(corpus.length, 39);
assert.equal(sha256(corpusBytes), manifest.output_sha256);
assert.equal(manifest.internal_only_sources_included, false);
assert.equal(manifest.public_runtime_integrated, true);
assert.equal(manifest.deployment_performed, false);
assert.equal(manifest.site_service_pages_reviewed, 12);
assert.equal(fs.existsSync(livePath), true);
assert.equal(sha256(liveBytes), manifest.output_sha256, "Integrated live corpus does not match the validated candidate.");
assert.equal(manifest.live_corpus_sha256, manifest.output_sha256);
assert.ok(corpus.every(c => typeof c.text === "string" && c.text.length > 40));
assert.ok(corpus.every(c => Array.isArray(c.embedding) && c.embedding.length === 2560 && c.embedding.every(Number.isFinite)));
assert.equal(new Set(corpus.filter(c => c.chunk_id).map(c => c.chunk_id)).size, 12);
const allowedSources = new Set([
  "01_DTM_IDENTITY_AND_GROWTH_METHOD.md",
  "02_PRIMARY_ICP_TRAVEL_EXPERIENCES.md",
  "03_SECONDARY_ICP_PREMIUM_REAL_ESTATE.md",
  "07_PUBLIC_FAQ_AND_SAFE_ANSWER_PATTERNS.md",
  "09_PRACTICAL_GROWTH_GUIDANCE.md",
  "10_PUBLIC_SERVICE_PATHWAYS.md",
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
console.log(JSON.stringify({ version: "v1.3.16", chunks: corpus.length, dimensions: 2560, retrieval_safety_cases: checks.length, outage_fallback: "passed", failures: 0, public_only: true, live_corpus_matches_candidate: true }));
