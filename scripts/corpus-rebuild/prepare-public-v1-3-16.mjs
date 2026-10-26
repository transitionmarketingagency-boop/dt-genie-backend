import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const dir = path.join(root, "server/vector_store");
const inputPath = path.join(root, "scripts/corpus-rebuild/public-service-pathways-v1-3-13.json");
const sourcePath = path.join(dir, "public_candidate_staging_v1_3_12.json");
const outputPath = path.join(dir, "public_candidate_staging_v1_3_16.json");
const manifestPath = path.join(dir, "public_candidate_staging_v1_3_16_manifest.json");
const model = "qwen/Qwen3-Embedding-4B";
const dimensions = 2560;
const sha256 = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is missing.");
for (const file of [outputPath, manifestPath]) {
  if (fs.existsSync(file)) throw new Error(`Refusing to overwrite existing output: ${path.basename(file)}`);
}
const records = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const baseBytes = fs.readFileSync(sourcePath);
const base = JSON.parse(baseBytes.toString("utf8"));
if (!Array.isArray(records) || records.length !== 12 || base.length !== 27) {
  throw new Error(`Unexpected corpus sizes (base=${base.length}, new=${records.length}).`);
}
if (new Set(records.map(row => row.chunk_id)).size !== records.length || records.some(row => !row.chunk_id)) {
  throw new Error("Duplicate chunk IDs detected.");
}
if (records.some(r => r.audience === "internal" || !r.text?.trim() || r.text.length < 80)) {
  throw new Error("Public source validation failed.");
}

const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model, input: records.map(r => r.text) }),
  signal: AbortSignal.timeout(120000),
});
if (!response.ok) throw new Error(`OpenRouter returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
const payload = await response.json();
if (!Array.isArray(payload.data) || payload.data.length !== records.length) throw new Error("Embedding response count mismatch.");
const vectors = new Array(records.length);
for (const row of payload.data) {
  if (!Number.isInteger(row.index) || row.index < 0 || row.index >= records.length || vectors[row.index]) throw new Error("Invalid embedding response ordering.");
  if (!Array.isArray(row.embedding) || row.embedding.length !== dimensions || !row.embedding.every(Number.isFinite) || !row.embedding.some(n => n !== 0)) throw new Error(`Invalid embedding vector at index ${row.index}.`);
  vectors[row.index] = row.embedding;
}
if (vectors.some(v => !v)) throw new Error("Embedding response omitted a vector.");
const added = records.map((r, i) => ({
  ...r,
  embedding: vectors[i],
  embedding_model: model,
  embedding_dimensions: dimensions,
  embedding_status: "GENERATED_PUBLIC_CANDIDATE_ONLY",
}));
const candidate = [...base, ...added];
const corpusBytes = Buffer.from(JSON.stringify(candidate, null, 2) + "\n");
const manifest = {
  status: "public_candidate_embedded_pending_validation",
  version: "v1.3.16",
  generated_at: new Date().toISOString(),
  model,
  dimensions,
  total_chunks: candidate.length,
  new_chunks: added.length,
  base_file: path.basename(sourcePath),
  base_sha256: sha256(baseBytes),
  new_source_file: path.relative(root, inputPath).replaceAll("\\", "/"),
  new_source_sha256: sha256(fs.readFileSync(inputPath)),
  output_file: path.basename(outputPath),
  output_sha256: sha256(corpusBytes),
  internal_only_sources_included: false,
  site_service_pages_reviewed: 12,
  claims_policy: "Service capabilities expressed conditionally; unverified website guarantees, performance metrics, prices, credentials and operational claims excluded.",
  public_runtime_integrated: false,
  deployment_performed: false,
};
fs.writeFileSync(outputPath, corpusBytes, { flag: "wx" });
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(manifest, null, 2));
