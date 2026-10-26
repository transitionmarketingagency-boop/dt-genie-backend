import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import process from "node:process";

process.env.NEONVISION_USE_PUBLIC_STAGING = "true";
process.env.NEONVISION_PUBLIC_STAGING_FILE = "public_candidate_staging_v1_3_12.json";
const { getTopChunks } = await import("../server/queryChunks.ts");

const corpusPath = "server/vector_store/public_candidate_staging_v1_3_12.json";
const manifestPath = "server/vector_store/public_candidate_staging_v1_3_12_manifest.json";
const livePath = "server/vector_store/chunks.json";
const internalPath = "server/vector_store/dtm_internal_candidate_v1_3_12.json";
const sha256 = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const corpusBytes = fs.readFileSync(corpusPath);
const corpus = JSON.parse(corpusBytes.toString("utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const liveBytes = fs.readFileSync(livePath);

assert.equal(corpus.length, 27);
assert.equal(sha256(corpusBytes), manifest.output_sha256);
if (manifest.production_integrated) {
  assert.equal(sha256(liveBytes), manifest.output_sha256, "Integrated public corpus does not match the validated candidate.");
  assert.equal(manifest.live_corpus_sha256, manifest.output_sha256);
} else {
  assert.equal(sha256(liveBytes), manifest.live_corpus_sha256, "Candidate preparation must not replace the live corpus.");
}
assert.equal(manifest.internal_only_sources_included, false);
assert.equal(manifest.deployment_performed, false);
assert.ok(!fs.existsSync(internalPath) || !corpus.some(chunk => chunk.text === JSON.parse(fs.readFileSync(internalPath, "utf8"))[0]?.text));
assert.ok(corpus.every(chunk => typeof chunk.text === "string" && chunk.text.length > 40));
assert.ok(corpus.every(chunk => Array.isArray(chunk.embedding) && chunk.embedding.length === 2560 && chunk.embedding.every(Number.isFinite)));
const allowedSources = new Set([
  "01_DTM_IDENTITY_AND_GROWTH_METHOD.md",
  "02_PRIMARY_ICP_TRAVEL_EXPERIENCES.md",
  "03_SECONDARY_ICP_PREMIUM_REAL_ESTATE.md",
  "07_PUBLIC_FAQ_AND_SAFE_ANSWER_PATTERNS.md",
  "09_PRACTICAL_GROWTH_GUIDANCE.md",
]);
assert.ok(corpus.every(chunk => allowedSources.has(chunk.source)), "Candidate contains an unreviewed public source.");

const retrievalCases = [
  ["What is Digital Transition Marketing?", /intelligence-driven Growth Partner/i],
  ["Which industries are the agency's primary and secondary focus?", /initial focus is Premium Travel|Premium Travel.*secondary market/i],
  ["I run a boutique hotel. Should I stop using OTAs and move all bookings direct?", /online travel agencies|OTAs/i],
  ["What is the best marketing channel for my company?", /universally best channel|no universally best channel/i],
  ["My ads are not performing. What should I diagnose?", /tracking quality|where the funnel is breaking/i],
  ["How do I get more qualified leads?", /qualified|good fit/i],
  ["Which workflow should I automate first?", /repeated, stable workflow|stable workflow/i],
  ["Can NeonVision act as an autonomous agent and run my business?", /chat assistant|cannot access a business account/i],
  ["Can you guarantee more leads, bookings, sales or ROI?", /does not guarantee/i],
  ["What case studies or client results can I review?", /approved source documents|client results/i],
  ["Which banks, payment methods, or fees are confirmed?", /cannot confirm|does not establish a confirmed payment/i],
];

const failures = [];
for (const [question, expected] of retrievalCases) {
  const matches = await getTopChunks(question, 3, 0.3);
  const joined = matches.map(match => match.text).join("\n");
  const passed = expected.test(joined);
  const sensitive = matches.some(match => /(?:\$\s*\d|\b(?:USD|PKR|GBP|AED)\s*\d|\b\d{10,}\b|api[_ -]?key\s*[:=]|password\s*[:=])/i.test(match.text));
  const result = { question, passed: passed && !sensitive, top_sources: matches.map(match => match.source) };
  console.log(JSON.stringify(result));
  if (!passed || sensitive) failures.push(result);
}

assert.equal(failures.length, 0, `${failures.length} public retrieval/safety cases failed.`);

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => { throw new Error("simulated embedding provider outage"); };
  const outageMatches = await getTopChunks("hotel OTA bookings direct net contribution fees", 3, 0.3);
  assert.ok(outageMatches.length > 0, "Keyword fallback should return useful public guidance when embedding service is unavailable.");
  assert.equal(outageMatches[0].source, "09_PRACTICAL_GROWTH_GUIDANCE.md");
} finally {
  globalThis.fetch = originalFetch;
}

console.log(JSON.stringify({ version: "v1.3.12", chunks: corpus.length, embedding_dimensions: 2560, retrieval_safety_cases: retrievalCases.length, outage_fallback: "passed", failures: 0, public_sources_only: true, repository_corpus_integrated: Boolean(manifest.production_integrated), deployment_pending: !manifest.deployment_performed }));
