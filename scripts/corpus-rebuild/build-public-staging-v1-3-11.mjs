import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const inputPath = path.join(root, "server/vector_store/public_candidate_staging_v1_3_10.json");
const outputPath = path.join(root, "server/vector_store/public_candidate_staging_v1_3_11.json");
const manifestPath = path.join(root, "server/vector_store/public_candidate_staging_v1_3_11_manifest.json");
const livePath = path.join(root, "server/vector_store/chunks.json");
const endpoint = "https://openrouter.ai/api/v1/embeddings";
const model = "qwen/Qwen3-Embedding-4B";
const dimensions = 2560;

const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");

if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is missing.");
if (fs.existsSync(outputPath) || fs.existsSync(manifestPath)) {
  throw new Error("v1.3.9 output already exists; refusing to overwrite it.");
}

const originalBytes = fs.readFileSync(inputPath);
const records = JSON.parse(originalBytes.toString("utf8"));
if (records.length !== 21 || records.some(record => !Array.isArray(record.embedding) || record.embedding.length !== dimensions)) {
  throw new Error("Expected the validated 21-chunk v1.3.10 public candidate.");
}

records[18].text = "## Do you have case studies or proven results?\nOnly share case studies, client results, or testimonials when an approved source documents them and authorizes their use. If the available context does not identify a specific approved example, say that you cannot confirm which examples are approved for sharing; do not imply that no results or approved examples exist. Offer to explain the process or demonstrate relevant capabilities without presenting demonstrations as client results.";
records[19].text = "## What should the assistant do when it does not know?\nState what is known, identify the missing information, and ask a focused follow-up. For security or certification claims, payment methods or providers, bank routes or fees, current tools or integrations, client results, and live operational status, say when the approved public sources do not confirm the detail. Offer human follow-up only if an approved source confirms that a route is available. Never fill gaps with invented details or present an unverified claim as current.";
records[20].text = "## Current payment and operational details\nThe current public knowledge set does not establish a confirmed payment provider, supported payment method, fees, bank route, or live payment status. The assistant must say that it cannot confirm the current detail from approved public information. It may offer human follow-up only if an approved source confirms that a route is available. Do not guess or present an unverified setup as current.\n\nSource basis: The public FAQ says not to claim a payment method or operational status is confirmed unless an approved source supports it.";

for (const index of [18, 19, 20]) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: records[index].text }),
    signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) throw new Error(`OpenRouter returned HTTP ${response.status}: ${(await response.text()).slice(0, 400)}`);
  const payload = await response.json();
  const vector = payload.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length !== dimensions || !vector.every(Number.isFinite)) {
    throw new Error(`Invalid vector for chunk index ${index}.`);
  }
  records[index] = { ...records[index], embedding: vector };
}

const outputBytes = Buffer.from(JSON.stringify(records, null, 2) + "\n", "utf8");
fs.writeFileSync(outputPath, outputBytes, { flag: "wx" });
const saved = JSON.parse(fs.readFileSync(outputPath, "utf8"));
if (saved.length !== 21 || saved.some(record => record.embedding?.length !== dimensions || !record.embedding.every(Number.isFinite))) {
  throw new Error("Saved candidate failed vector verification; preserve it for inspection.");
}

const manifest = {
  status: "isolated_public_staging_candidate_not_production_approved",
  generated_at: new Date().toISOString(),
  model,
  dimensions,
  total_chunks: saved.length,
  changed_chunks_reembedded: ["public_proof_unknowns", "public_unknowns_guidance", "public_payment_unknowns"],
  input_file: path.basename(inputPath),
  input_sha256: sha256(originalBytes),
  output_file: path.basename(outputPath),
  output_sha256: sha256(outputBytes),
  live_corpus_sha256: sha256(fs.readFileSync(livePath)),
  internal_only_sources_included: false,
  production_integrated: false,
  deployment_performed: false
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(manifest, null, 2));
