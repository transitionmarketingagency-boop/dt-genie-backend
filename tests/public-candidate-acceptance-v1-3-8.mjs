import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

process.env.NEONVISION_USE_PUBLIC_STAGING = "true";
const { getTopChunks } = await import("../server/queryChunks.ts");
const corpusPath = "server/vector_store/public_candidate_staging_v1_3_8.json";
const manifestPath = "server/vector_store/public_candidate_staging_v1_3_8_manifest.json";
const livePath = "server/vector_store/chunks.json";
const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const sha = data => crypto.createHash("sha256").update(data).digest("hex");
assert.equal(corpus.length, 21);
assert.ok(corpus.every(c => Array.isArray(c.embedding) && c.embedding.length === 2560 && c.embedding.every(Number.isFinite)));
const allowedSources = new Set(["01_DTM_IDENTITY_AND_GROWTH_METHOD.md", "02_PRIMARY_ICP_TRAVEL_EXPERIENCES.md", "03_SECONDARY_ICP_PREMIUM_REAL_ESTATE.md", "07_PUBLIC_FAQ_AND_SAFE_ANSWER_PATTERNS.md"]);
assert.ok(corpus.every(c => allowedSources.has(c.source)), "Public corpus contains a source outside the reviewed public set.");
const tests = [
  ["What is DTM and how does it help businesses?", ["growth partner"]],
  ["Which travel businesses are DTM primary focus?", ["premium travel", "experiences"]],
  ["Does DTM also work with premium real estate?", ["real estate", "secondary"]],
  ["Can DTM guarantee leads, bookings, sales or ROI?", ["does not guarantee"]],
  ["What does DTM cost and what are its prices?", ["investment depends", "internal pricing bands"]],
  ["What client results, testimonials or case studies can you verify?", ["only share case studies", "approved source documents them"]],
  ["Which payment providers, fees and bank routes are confirmed?", ["does not establish a confirmed payment provider"]],
  ["What should the assistant say when it does not know an answer?", ["identify the missing information", "never fill gaps with invented details"]]
];
let failures = 0;
for (const [question, expected] of tests) {
  const results = await getTopChunks(question, 3, 0.35);
  const text = results.map(r => r.text).join(" ").toLowerCase();
  const matched = expected.some(phrase => text.includes(phrase));
  const safe = results.every(r => !/(\$\s*\d|\b(?:USD|PKR|GBP|AED)\s*\d|\b\d{10,}\b|api[_ -]?key\s*[:=]|password\s*[:=])/i.test(r.text));
  const pass = matched && safe;
  if (!pass) failures++;
  console.log(JSON.stringify({ question, pass, matched, safe, top: results.map(r => ({ source: r.source, score: r.score })) }));
}
assert.equal(failures, 0, `${failures} retrieval/safety cases failed.`);
assert.equal(sha(fs.readFileSync(livePath)), manifest.live_corpus_sha256, "Live corpus changed.");
console.log(JSON.stringify({ acceptance_cases: tests.length, failures, candidate_chunks: corpus.length, live_corpus_unchanged: true }));
