import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const vectorDir = path.join(root, "server", "vector_store");
const sourceFile = path.join(root, "knowledge", "public", "09_PRACTICAL_GROWTH_GUIDANCE.md");
const inputFile = path.join(vectorDir, "public_candidate_staging_v1_3_11.json");
const outputFile = path.join(vectorDir, "public_candidate_staging_v1_3_12.json");
const manifestFile = path.join(vectorDir, "public_candidate_staging_v1_3_12_manifest.json");
const liveFile = path.join(vectorDir, "chunks.json");
const model = "qwen/Qwen3-Embedding-4B";
const dimensions = 2560;

const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");
const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error("OPENROUTER_API_KEY is required; no files were changed.");

const source = fs.readFileSync(sourceFile, "utf8");
const sections = source.split(/^## /m).slice(1)
  .map(block => {
    const [title, ...body] = block.split(/\r?\n/);
    return { text: `## ${title.trim()}\n\n${body.join("\n").trim()}`, source: path.basename(sourceFile), intent: "general" };
  })
  .filter(chunk => chunk.text.length > 80);

if (sections.length !== 6) throw new Error(`Expected 6 reviewed public guidance sections; found ${sections.length}.`);

const inputBytes = fs.readFileSync(inputFile);
const base = JSON.parse(inputBytes.toString("utf8"));
if (!Array.isArray(base) || base.length !== 21) throw new Error("The validated v1.3.11 base corpus is not the expected 21 chunks.");
if (base.some(chunk => chunk.audience === "internal" || /internal|payment|treasury|pricing architecture/i.test(chunk.source || ""))) {
  throw new Error("The public base corpus contains an internal-only source.");
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 45000);
let response;
try {
  response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: sections.map(chunk => chunk.text) }),
    signal: controller.signal,
  });
} finally {
  clearTimeout(timer);
}
if (!response.ok) throw new Error(`OpenRouter embedding request failed with HTTP ${response.status}.`);

const payload = await response.json();
if (!Array.isArray(payload.data) || payload.data.length !== sections.length) {
  throw new Error("Embedding response count did not match reviewed sections.");
}
const ordered = new Array(sections.length);
for (const item of payload.data) {
  if (!Number.isInteger(item.index) || item.index < 0 || item.index >= sections.length || ordered[item.index]) {
    throw new Error("Embedding response had missing or duplicate indexes.");
  }
  const embedding = item.embedding?.map(Number);
  if (!embedding || embedding.length !== dimensions || embedding.some(value => !Number.isFinite(value))) {
    throw new Error(`Invalid embedding at index ${item.index}.`);
  }
  ordered[item.index] = embedding;
}

const additions = sections.map((chunk, index) => ({ ...chunk, embedding: ordered[index] }));
const normalizedText = value => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const seen = new Set(base.map(chunk => normalizedText(chunk.text)));
for (const chunk of additions) {
  const normalized = normalizedText(chunk.text);
  if (seen.has(normalized)) throw new Error(`Duplicate knowledge section: ${chunk.source}`);
  seen.add(normalized);
}
const corpus = [...base, ...additions];
if (corpus.some(chunk => chunk.embedding.length !== dimensions || chunk.embedding.some(value => !Number.isFinite(value)))) {
  throw new Error("Final candidate contains an invalid vector.");
}
if (corpus.some(chunk => /DTM_MASTER_|pricing architecture|payment|treasury|CRM master lock|sales operating system/i.test(chunk.source || ""))) {
  throw new Error("Final candidate includes an internal source family.");
}

const outputBytes = Buffer.from(`${JSON.stringify(corpus, null, 2)}\n`);
const liveBytes = fs.readFileSync(liveFile);
const manifest = {
  status: "isolated_public_candidate_ready_for_retrieval_and_answer_validation",
  generated_at: new Date().toISOString(),
  version: "v1.3.12",
  model,
  dimensions,
  total_chunks: corpus.length,
  added_chunks: additions.length,
  added_sources: [...new Set(additions.map(chunk => chunk.source))],
  input_file: path.basename(inputFile),
  input_sha256: sha256(inputBytes),
  output_file: path.basename(outputFile),
  output_sha256: sha256(outputBytes),
  live_corpus_sha256: sha256(liveBytes),
  previous_live_corpus_sha256: sha256(liveBytes),
  internal_only_sources_included: false,
  public_runtime_integrated: false,
  deployment_performed: false,
};

fs.writeFileSync(outputFile, outputBytes);
fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ version: manifest.version, chunks: manifest.total_chunks, added: manifest.added_chunks, model, dimensions, public_sources_only: true, runtime_unchanged: true, sha256: manifest.output_sha256 }));
