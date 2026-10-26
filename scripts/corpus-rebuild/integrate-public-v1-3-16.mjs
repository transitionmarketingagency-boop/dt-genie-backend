import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const vectorDir = path.join(root, "server", "vector_store");
const candidatePath = path.join(vectorDir, "public_candidate_staging_v1_3_16.json");
const manifestPath = path.join(vectorDir, "public_candidate_staging_v1_3_16_manifest.json");
const livePath = path.join(vectorDir, "chunks.json");
const allowedSources = new Set([
  "01_DTM_IDENTITY_AND_GROWTH_METHOD.md",
  "02_PRIMARY_ICP_TRAVEL_EXPERIENCES.md",
  "03_SECONDARY_ICP_PREMIUM_REAL_ESTATE.md",
  "07_PUBLIC_FAQ_AND_SAFE_ANSWER_PATTERNS.md",
  "09_PRACTICAL_GROWTH_GUIDANCE.md",
  "10_PUBLIC_SERVICE_PATHWAYS.md",
]);
const sha256 = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const candidateBytes = fs.readFileSync(candidatePath);
const candidate = JSON.parse(candidateBytes.toString("utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const oldLiveBytes = fs.readFileSync(livePath);
const expectedPreviousHash = "6f48d3077f2a781877fa789420267fd45a12d04680199e9551fb737677fc5644";

if (manifest.version !== "v1.3.16" || candidate.length !== 39 || manifest.total_chunks !== 39) throw new Error("Unexpected public candidate version or count.");
if (sha256(candidateBytes) !== manifest.output_sha256) throw new Error("Candidate hash does not match its manifest.");
if (sha256(oldLiveBytes) !== expectedPreviousHash) throw new Error("Live corpus changed since validation; integration stopped.");
if (manifest.internal_only_sources_included !== false || manifest.site_service_pages_reviewed !== 12) throw new Error("Manifest does not establish the reviewed public-only source scope.");
if (candidate.some(chunk => !allowedSources.has(chunk.source) || chunk.audience === "internal")) throw new Error("Candidate contains an unreviewed or internal-only source.");
if (candidate.some(chunk => typeof chunk.text !== "string" || !Array.isArray(chunk.embedding) || chunk.embedding.length !== 2560 || chunk.embedding.some(value => !Number.isFinite(value)))) throw new Error("Candidate has invalid text or vectors.");
if (candidate.some(chunk => /(?:\$\s*\d|\b(?:USD|PKR|GBP|AED)\s*\d|\b\d{10,}\b|api[_ -]?key\s*[:=]|password\s*[:=])/i.test(chunk.text))) throw new Error("Public candidate failed the sensitive-claim scan.");

const nextManifest = {
  ...manifest,
  status: "public_candidate_validated_and_integrated_in_repository_deployment_pending",
  production_integrated: true,
  repository_integrated: true,
  public_runtime_integrated: true,
  deployment_performed: false,
  deployment_commit: null,
  retrieval_validation_cases: 20,
  answer_generation_cases: 17,
  live_corpus_sha256: manifest.output_sha256,
  previous_live_corpus_sha256: sha256(oldLiveBytes),
  integrated_at: new Date().toISOString(),
};
const liveTemp = `${livePath}.tmp`;
const manifestTemp = `${manifestPath}.tmp`;
fs.writeFileSync(liveTemp, candidateBytes);
fs.renameSync(liveTemp, livePath);
fs.writeFileSync(manifestTemp, `${JSON.stringify(nextManifest, null, 2)}\n`);
fs.renameSync(manifestTemp, manifestPath);
console.log(JSON.stringify({ status: nextManifest.status, chunks: candidate.length, corpus_sha256: nextManifest.output_sha256, internal_sources_included: false, deployment_performed: false, rollback_hash: nextManifest.previous_live_corpus_sha256 }));
