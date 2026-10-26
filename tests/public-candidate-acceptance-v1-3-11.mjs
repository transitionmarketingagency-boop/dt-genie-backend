import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

const corpusPath = "server/vector_store/public_candidate_staging_v1_3_11.json";
const reportPath = "server/vector_store/public_candidate_answer_safety_v1_3_11_results.json";
const livePath = "server/vector_store/chunks.json";
const manifestPath = "server/vector_store/public_candidate_staging_v1_3_11_manifest.json";
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const corpusBytes = fs.readFileSync(corpusPath);
const corpus = JSON.parse(corpusBytes.toString("utf8"));
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const liveBytes = fs.readFileSync(livePath);

assert.equal(corpus.length, 21);
assert.ok(corpus.every(chunk => Array.isArray(chunk.embedding) && chunk.embedding.length === 2560 && chunk.embedding.every(Number.isFinite)));
const allowedSources = new Set([
  "01_DTM_IDENTITY_AND_GROWTH_METHOD.md",
  "02_PRIMARY_ICP_TRAVEL_EXPERIENCES.md",
  "03_SECONDARY_ICP_PREMIUM_REAL_ESTATE.md",
  "07_PUBLIC_FAQ_AND_SAFE_ANSWER_PATTERNS.md"
]);
assert.ok(corpus.every(chunk => allowedSources.has(chunk.source)));
assert.equal(report.corpus_sha256, hash(corpusBytes));
assert.equal(report.results.length, 18);
assert.ok(report.results.every(result => result.status === "success" && result.retrieved_chunks.length === 3));
assert.ok(report.results.every(result => result.retrieved_chunks.every(match => corpus.some(chunk => chunk.text === match.exact_text))));
assert.equal(manifest.live_corpus_sha256, hash(liveBytes));
assert.equal(manifest.internal_only_sources_included, false);

const cases = [
  ["PUB-01", /intelligence-driven Growth Partner/i],
  ["PUB-02", /Premium Travel\s*&\s*Experiences/i],
  ["PUB-10", /Boutique.{0,12}Premium Real Estate.{0,40}secondary market/i],
  ["PUB-11", /does not guarantee/i],
  ["PUB-06", /investment depends/i],
  ["PUB-05", /cannot confirm which specific client results/i],
  ["PUB-13", /cannot confirm the specific payment methods or banks/i],
  ["PUB-14", /does not confirm the specific AI models, integrations, or tools/i]
];

for (const [id, expected] of cases) {
  const result = report.results.find(item => item.id === id);
  assert.ok(result, `Missing answer case ${id}`);
  assert.match(result.final_answer, expected, `${id} failed its answer expectation`);
  const safeText = [result.final_answer, ...result.retrieved_chunks.map(chunk => chunk.exact_text)].join("\n");
  assert.doesNotMatch(safeText, /(?:\$\s*\d|\b(?:USD|PKR|GBP|AED)\s*\d|\b\d{10,}\b|api[_ -]?key\s*[:=]|password\s*[:=])/i, `${id} contains sensitive numeric or credential material`);
}

console.log(JSON.stringify({
  corpus_chunks: corpus.length,
  retrieval_answer_generations: report.results.length,
  targeted_retrieval_safety_cases: cases.length,
  generation_errors: report.results.filter(result => result.status !== "success").length,
  live_corpus_unchanged: hash(liveBytes) === manifest.live_corpus_sha256,
  public_sources_only: true
}));
