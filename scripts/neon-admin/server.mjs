import "dotenv/config";
import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { getEmbeddingsBatch } from "../../server/services/openRouterEmbeddingsClient.ts";

const app = express();
const port = Number(process.env.NEON_ADMIN_PORT || 4177);
const host = "127.0.0.1";
const here = path.dirname(fileURLToPath(import.meta.url));
const uiDir = path.join(here, "ui");
const repoRoot = path.resolve(here, "../..");
const dataDir = process.env.NEON_ADMIN_DATA_DIR || path.join(process.env.LOCALAPPDATA || os.homedir(), "NeonVision", "admin-dashboard");
const documentsFile = path.join(dataDir, "documents.json");
const auditFile = path.join(dataDir, "audit.jsonl");
const setupFile = path.join(dataDir, "admin-auth.json");
const baselinePublicFile = path.join(repoRoot, "server/vector_store/chunks.json");
const localInternalCorpusFile = path.join(repoRoot, "server/vector_store/dtm_internal_candidate_v1_4_0.json");
const SESSION_MS = 8 * 60 * 60 * 1000;
const FILE_LIMIT = 8 * 1024 * 1024;
const CORPUS_LIMIT = 32 * 1024 * 1024;
const DIMENSIONS = 2560;

if (process.env.NEON_ADMIN_HOST && process.env.NEON_ADMIN_HOST !== host) {
  throw new Error("The knowledge dashboard must bind to 127.0.0.1 only.");
}
fs.mkdirSync(dataDir, { recursive: true });

const sessions = new Map();
const loginFailures = new Map();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: FILE_LIMIT, files: 1 } });
const corpusUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: CORPUS_LIMIT, files: 1 } });
const scrypt = promisify(crypto.scrypt);

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function writeJsonAtomic(file, value) {
  const temp = `${file}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  fs.renameSync(temp, file);
}
function readDocuments() { return readJson(documentsFile, []); }
function saveDocuments(documents) { writeJsonAtomic(documentsFile, documents); }
function audit(action, data = {}) {
  fs.appendFileSync(auditFile, JSON.stringify({ at: new Date().toISOString(), action, ...data }) + "\n", { mode: 0o600 });
}
function hashText(text) { return crypto.createHash("sha256").update(text).digest("hex"); }
function cookieValue(req, key) {
  const entry = (req.headers.cookie || "").split(";").map(x => x.trim()).find(x => x.startsWith(`${key}=`));
  return entry ? decodeURIComponent(entry.slice(key.length + 1)) : "";
}
function expectedOrigin(req) { return `http://${req.headers.host}`; }
function isLocalRequest(req) {
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress) &&
    ["127.0.0.1", `127.0.0.1:${port}`].includes(req.headers.host);
}
function requireLocal(req, res, next) {
  if (!isLocalRequest(req)) return res.status(404).end();
  next();
}
function requireSameOrigin(req, res, next) {
  if (!isLocalRequest(req) || req.get("origin") !== expectedOrigin(req)) return res.status(403).json({ error: "Local same-origin request required." });
  next();
}
function makeSession(res) {
  const id = crypto.randomBytes(32).toString("base64url");
  const csrf = crypto.randomBytes(24).toString("base64url");
  const expires = Date.now() + SESSION_MS;
  sessions.set(id, { csrf, expires });
  res.cookie("neon_admin", id, { httpOnly: true, sameSite: "strict", secure: false, path: "/", maxAge: SESSION_MS });
  return { csrf, expiresAt: new Date(expires).toISOString() };
}
function requireAdmin(req, res, next) {
  const id = cookieValue(req, "neon_admin");
  const session = sessions.get(id);
  if (!session || session.expires < Date.now()) {
    sessions.delete(id);
    return res.status(401).json({ error: "Sign in to the local admin dashboard." });
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (req.get("origin") !== expectedOrigin(req) || req.get("x-csrf-token") !== session.csrf) {
      return res.status(403).json({ error: "Request verification failed. Refresh the dashboard and try again." });
    }
  }
  req.adminSession = session;
  next();
}
function authConfig() { return readJson(setupFile, null); }
function assertChunk(row) {
  return row && typeof row.text === "string" && row.text.length > 40 &&
    Array.isArray(row.embedding) && row.embedding.length === DIMENSIONS &&
    row.embedding.every(Number.isFinite) && row.embedding.some(value => value !== 0);
}
function sanitize(text) {
  let out = text;
  out = out.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]");
  out = out.replace(/\b(?:sk|rk|pk)[-_][A-Za-z0-9_-]{16,}|\b(?:api[_ -]?key|access[_ -]?token|password)\s*[:=]\s*\S{8,}/gi, "[credential redacted]");
  out = out.replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, "[bank identifier redacted]");
  out = out.replace(/\b(?:\+?\d[\d ().-]{9,}\d)\b/g, "[number redacted]");
  return out;
}
function chunkText(text, maxChars = 1350, overlap = 160) {
  const normalized = text.replace(/\r/g, "").replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const paragraphs = normalized.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  const out = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const pieces = paragraph.length > maxChars ? paragraph.match(new RegExp(`[\\s\\S]{1,${maxChars}}`, "g")) || [] : [paragraph];
    for (const piece of pieces) {
      if (current && (current.length + piece.length + 2 > maxChars)) {
        out.push(current.trim());
        current = current.slice(-overlap);
      }
      current = `${current}${current ? "\n\n" : ""}${piece}`;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out.filter(x => x.length > 80);
}
async function extractText(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  let text;
  if ([".md", ".txt"].includes(ext)) text = file.buffer.toString("utf8");
  else if (ext === ".pdf") {
    const pdfModule = await import("pdf-parse");
    const parsePdf = pdfModule.default || pdfModule;
    const parsed = await parsePdf(file.buffer);
    text = parsed.text;
  } else if (ext === ".docx") {
    const mammoth = await import("mammoth");
    text = (await mammoth.default.extractRawText({ buffer: file.buffer })).value;
  } else throw new Error("Choose a PDF, DOCX, Markdown, or text file.");
  const safe = sanitize(String(text || ""));
  if (safe.length < 120) throw new Error("The file has too little extractable text. Scanned PDFs need OCR before upload.");
  if (safe.length > 2_000_000) throw new Error("Extracted text exceeds the 2 MB safety limit.");
  return safe;
}
async function embedChunks(texts) {
  const vectors = [];
  for (let start = 0; start < texts.length; start += 24) {
    const result = await getEmbeddingsBatch(texts.slice(start, start + 24), { timeoutMs: 60000, fallbackToSingle: false });
    if (result.length !== Math.min(24, texts.length - start) || result.some(v => !Array.isArray(v) || v.length !== DIMENSIONS || v.some(n => !Number.isFinite(n)) || !v.some(n => n !== 0))) {
      throw new Error("Embedding service did not return a valid vector for every chunk. Nothing was saved; retry later.");
    }
    vectors.push(...result);
  }
  return vectors;
}
function makeChunks(doc, audience, texts, vectors, offset = 0) {
  return texts.map((text, i) => ({
    chunk_id: `${audience}-${doc.id}-${String(offset + i + 1).padStart(4, "0")}`,
    audience,
    source: doc.fileName,
    source_file: doc.fileName,
    text,
    embedding: vectors[i],
    embedding_model: "qwen/Qwen3-Embedding-4B",
    embedding_dimensions: DIMENSIONS,
    text_sha256: hashText(text),
  }));
}
function cosine(a, b) {
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
function allChunks(docs, audience) { return docs.filter(d => d.audience === audience && d.status === "active").flatMap(d => d.chunks || []); }
function addDocument(doc) {
  const docs = readDocuments();
  docs.push(doc);
  saveDocuments(docs);
}

// Import the existing internal candidate into the protected local data folder on first run.
if (!fs.existsSync(documentsFile)) {
  const docs = [];
  if (fs.existsSync(localInternalCorpusFile)) {
    const rows = JSON.parse(fs.readFileSync(localInternalCorpusFile, "utf8"));
    const localCorpusSafe = Array.isArray(rows) && rows.every(row => row.audience === "internal" && assertChunk(row)) &&
      !rows.some(row => /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(row.text) || /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/.test(row.text) || /\b(?:sk|rk|pk)[-_][A-Za-z0-9_-]{16,}/i.test(row.text));
    if (localCorpusSafe) {
      const grouped = new Map();
      for (const row of rows) {
        const key = String(row.source_file || row.source || "internal-source");
        const list = grouped.get(key) || [];
        list.push(row);
        grouped.set(key, list);
      }
      for (const [fileName, chunks] of grouped) docs.push({
        id: crypto.randomUUID(), fileName, audience: "internal", status: "active",
        contentHash: hashText(chunks.map(c => c.text).join("\n")),
        extractedText: chunks.map(c => c.text).join("\n\n"),
        chunks, createdAt: new Date().toISOString(), imported: true, source: "internal_corpus_import",
      });
    }
  }
  saveDocuments(docs);
}

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if (req.path.startsWith("/api/")) return requireLocal(req, res, next);
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(express.static(uiDir, { index: "index.html", fallthrough: true, dotfiles: "deny", maxAge: 0 }));

app.get("/api/setup-status", requireLocal, (_req, res) => res.json({ configured: Boolean(authConfig()), dataDirectory: dataDir }));

app.post("/api/setup", requireSameOrigin, async (req, res) => {
  if (authConfig()) return res.status(409).json({ error: "Admin password is already configured." });
  const password = String(req.body?.password || "");
  if (password.length < 14 || password.length > 256) return res.status(400).json({ error: "Use a unique password with at least 14 characters." });
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  writeJsonAtomic(setupFile, { scheme: "scrypt", salt: salt.toString("base64url"), hash: Buffer.from(derived).toString("base64url"), createdAt: new Date().toISOString() });
  audit("admin_setup_completed");
  return res.json({ ok: true, ...makeSession(res) });
});

app.post("/api/login", requireSameOrigin, async (req, res) => {
  const ip = req.socket.remoteAddress || "local";
  const failure = loginFailures.get(ip) || { count: 0, until: 0 };
  if (failure.until > Date.now()) return res.status(429).json({ error: "Too many attempts. Wait 15 minutes and try again." });
  const config = authConfig();
  if (!config) return res.status(409).json({ error: "Set up the admin password first." });
  const password = String(req.body?.password || "").slice(0, 256);
  const candidate = Buffer.from(await scrypt(password, Buffer.from(config.salt, "base64url"), 64));
  const expected = Buffer.from(config.hash, "base64url");
  const ok = candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  if (!ok) {
    failure.count += 1;
    if (failure.count >= 5) { failure.count = 0; failure.until = Date.now() + 15 * 60 * 1000; }
    loginFailures.set(ip, failure);
    return res.status(401).json({ error: "Password not accepted." });
  }
  loginFailures.delete(ip);
  audit("admin_login");
  return res.json({ ok: true, ...makeSession(res) });
});

app.get("/api/session", requireLocal, (req, res) => {
  const session = sessions.get(cookieValue(req, "neon_admin"));
  if (!session || session.expires < Date.now()) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, csrf: session.csrf, expiresAt: new Date(session.expires).toISOString() });
});

app.post("/api/logout", requireAdmin, (req, res) => {
  sessions.delete(cookieValue(req, "neon_admin"));
  res.clearCookie("neon_admin", { httpOnly: true, sameSite: "strict", path: "/" });
  audit("admin_logout");
  res.json({ ok: true });
});

app.post("/api/change-password", requireAdmin, async (req, res) => {
  const oldPassword = String(req.body?.oldPassword || "").slice(0, 256);
  const newPassword = String(req.body?.newPassword || "");
  if (newPassword.length < 14 || newPassword.length > 256) return res.status(400).json({ error: "Use a unique new password with at least 14 characters." });
  const config = authConfig();
  const candidate = Buffer.from(await scrypt(oldPassword, Buffer.from(config.salt, "base64url"), 64));
  const expected = Buffer.from(config.hash, "base64url");
  if (candidate.length !== expected.length || !crypto.timingSafeEqual(candidate, expected)) return res.status(401).json({ error: "Current password not accepted." });
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(newPassword, salt, 64);
  writeJsonAtomic(setupFile, { scheme: "scrypt", salt: salt.toString("base64url"), hash: Buffer.from(derived).toString("base64url"), createdAt: config.createdAt, updatedAt: new Date().toISOString() });
  sessions.clear();
  audit("admin_password_changed");
  return res.json({ ok: true, ...makeSession(res) });
});

app.get("/api/overview", requireAdmin, (_req, res) => {
  const docs = readDocuments();
  const baseline = readJson(baselinePublicFile, []);
  res.json({
    publicBaselineChunks: Array.isArray(baseline) ? baseline.length : 0,
    activePublicChunks: allChunks(docs, "public").length,
    activeInternalChunks: allChunks(docs, "internal").length,
    documents: docs.length,
    draftDocuments: docs.filter(d => d.status === "draft").length,
    activePublicDocuments: docs.filter(d => d.audience === "public" && d.status === "active").length,
    internalDocuments: docs.filter(d => d.audience === "internal").length,
    dataDirectory: dataDir,
  });
});

app.get("/api/documents", requireAdmin, (_req, res) => {
  const docs = readDocuments().map(({ extractedText, chunks, ...doc }) => ({ ...doc, preview: String(extractedText || "").slice(0, 480), chunkCount: chunks?.length || 0 }));
  res.json({ documents: docs });
});

app.get("/api/documents/:id", requireAdmin, (req, res) => {
  const doc = readDocuments().find(item => item.id === req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  res.json({ id: doc.id, fileName: doc.fileName, audience: doc.audience, status: doc.status, contentHash: doc.contentHash, extractedText: doc.extractedText || "", chunkCount: doc.chunks?.length || 0 });
});

app.post("/api/upload", requireAdmin, upload.single("document"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Choose a document first." });
    const audience = req.body.audience === "public" ? "public" : "internal";
    const fileName = path.basename(req.file.originalname).slice(0, 160);
    const content = await extractText({ ...req.file, originalname: fileName });
    const contentHash = hashText(content);
    if (readDocuments().some(doc => doc.audience === audience && doc.contentHash === contentHash)) return res.status(409).json({ error: "This document is already in the local knowledge library." });
    const pieces = chunkText(content);
    if (!pieces.length || pieces.length > 800) return res.status(400).json({ error: "Document chunk count is outside the 1–800 safety limit." });
    const vectors = await embedChunks(pieces);
    const doc = {
      id: crypto.randomUUID(), fileName, audience, status: "draft", contentHash,
      extractedText: content, chunks: [], createdAt: new Date().toISOString(),
      source: "admin_upload", approvedForPublic: false,
    };
    doc.chunks = makeChunks(doc, audience, pieces, vectors);
    addDocument(doc);
    audit("document_uploaded_as_draft", { id: doc.id, audience, fileName, chunkCount: doc.chunks.length, contentHash });
    res.json({ ok: true, document: { id: doc.id, fileName, audience, status: doc.status, chunkCount: doc.chunks.length, preview: content.slice(0, 480) } });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Document could not be processed." });
  }
});

app.post("/api/import-internal-corpus", requireAdmin, corpusUpload.single("corpus"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Choose the internal corpus JSON." });
    if (path.extname(req.file.originalname).toLowerCase() !== ".json") return res.status(400).json({ error: "Only the validated internal JSON corpus is supported." });
    const rows = JSON.parse(req.file.buffer.toString("utf8"));
    if (!Array.isArray(rows) || !rows.length || rows.length > 10000 || rows.some(row => row.audience !== "internal" || !assertChunk(row))) {
      return res.status(400).json({ error: "Import rejected: expected an internal-only corpus with valid 2560-dimensional embeddings." });
    }
    const ids = new Set(rows.map(row => row.chunk_id));
    if (ids.size !== rows.length || rows.some(row => !row.chunk_id)) return res.status(400).json({ error: "Import rejected: chunk IDs must be present and unique." });
    const allText = rows.map(row => row.text).join("\n");
    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(allText) || /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/.test(allText) || /\b(?:sk|rk|pk)[-_][A-Za-z0-9_-]{16,}/i.test(allText)) {
      return res.status(400).json({ error: "Import rejected: remove email addresses or financial/API credentials before importing this internal corpus." });
    }
    const existing = readDocuments();
    if (existing.some(doc => doc.source === "internal_corpus_import" && doc.status !== "archived")) return res.status(409).json({ error: "An active internal corpus is already imported. Archive it before importing another." });
    const groups = new Map();
    for (const row of rows) {
      const fileName = String(row.source_file || row.source || "internal-corpus").slice(0, 160);
      const group = groups.get(fileName) || [];
      group.push(row);
      groups.set(fileName, group);
    }
    const at = new Date().toISOString();
    for (const [fileName, chunks] of groups) existing.push({
      id: crypto.randomUUID(), fileName, audience: "internal", status: "active", source: "internal_corpus_import",
      contentHash: hashText(chunks.map(c => c.text).join("\n")), extractedText: chunks.map(c => c.text).join("\n\n"),
      chunks: chunks.map((row, i) => ({ ...row, chunk_id: `${crypto.randomUUID()}-${i}`, audience: "internal" })),
      createdAt: at, imported: true,
    });
    saveDocuments(existing);
    audit("internal_corpus_imported", { chunkCount: rows.length, documentCount: groups.size, sourceCorpus: path.basename(req.file.originalname) });
    res.json({ ok: true, chunkCount: rows.length, documentCount: groups.size });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Internal corpus import failed." });
  }
});

app.patch("/api/documents/:id/status", requireAdmin, (req, res) => {
  const docs = readDocuments();
  const doc = docs.find(item => item.id === req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  const status = req.body?.status;
  if (!["draft", "active", "paused", "archived"].includes(status)) return res.status(400).json({ error: "Choose a supported status." });
  if (doc.audience === "public" && status === "active" && req.body?.approvalPhrase !== "APPROVE PUBLIC") return res.status(400).json({ error: "Public activation requires the exact approval phrase: APPROVE PUBLIC." });
  if (doc.audience === "internal" && status === "active" && req.body?.approvalPhrase !== "ACTIVATE INTERNAL") return res.status(400).json({ error: "Internal activation requires the exact approval phrase: ACTIVATE INTERNAL." });
  doc.status = status;
  doc.approvedForPublic = doc.audience === "public" && status === "active";
  doc.updatedAt = new Date().toISOString();
  saveDocuments(docs);
  audit("document_status_changed", { id: doc.id, audience: doc.audience, status });
  res.json({ ok: true, id: doc.id, status: doc.status });
});

app.delete("/api/documents/:id", requireAdmin, (req, res) => {
  const docs = readDocuments();
  const index = docs.findIndex(item => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: "Document not found." });
  const [removed] = docs.splice(index, 1);
  saveDocuments(docs);
  audit("document_deleted", { id: removed.id, audience: removed.audience, fileName: removed.fileName });
  res.json({ ok: true });
});

app.post("/api/internal/search", requireAdmin, async (req, res) => {
  try {
    const question = String(req.body?.question || "").trim().slice(0, 1200);
    if (question.length < 4) return res.status(400).json({ error: "Enter a question of at least four characters." });
    const tokens = question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [];
    const uniqueTokens = [...new Set(tokens)];
    const chunks = allChunks(readDocuments(), "internal");
    const hits = chunks.map(row => {
      const text = row.text.toLowerCase();
      const matched = uniqueTokens.filter(token => text.includes(token)).length;
      const phrase = text.includes(question.toLowerCase()) ? 2 : 0;
      return { row, score: (matched + phrase) / Math.max(uniqueTokens.length, 1) };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
    audit("internal_local_search", { resultCount: hits.length });
    res.json({ results: hits.map(({ row, score }) => ({ text: row.text, source: row.source_file || row.source, score: Number(score.toFixed(4)) })) });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Internal retrieval failed." }); }
});

app.post("/api/prepare-public-candidate", requireAdmin, (req, res) => {
  try {
    if (req.body?.approvalPhrase !== "PREPARE PUBLIC CANDIDATE") return res.status(400).json({ error: "Type PREPARE PUBLIC CANDIDATE to confirm." });
    const baseline = readJson(baselinePublicFile, null);
    if (!Array.isArray(baseline) || baseline.some(row => row.audience === "internal")) return res.status(500).json({ error: "The committed public baseline failed its safety check." });
    const additions = allChunks(readDocuments(), "public");
    const ids = new Set(baseline.map(row => row.chunk_id).filter(Boolean));
    const textKeys = new Set(baseline.map(row => String(row.text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()));
    const safeAdditions = additions.filter(row => {
      const key = String(row.text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      if (ids.has(row.chunk_id) || textKeys.has(key)) return false;
      ids.add(row.chunk_id);
      textKeys.add(key);
      return true;
    });
    const corpus = [...baseline, ...safeAdditions];
    if (corpus.some(row => row.audience === "internal" || !assertChunk(row))) return res.status(500).json({ error: "Candidate rejected: internal or invalid chunk detected." });
    const outputDir = path.join(repoRoot, "server/vector_store");
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const output = path.join(outputDir, `admin_public_candidate_${stamp}.json`);
    writeJsonAtomic(output, corpus);
    const summary = { outputFile: path.basename(output), chunks: corpus.length, baselineChunks: baseline.length, additions: safeAdditions.length, internalChunks: 0, sha256: hashText(JSON.stringify(corpus, null, 2) + "\n"), status: "candidate_only_not_deployed" };
    audit("public_candidate_prepared", summary);
    res.json(summary);
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Could not prepare candidate." }); }
});

app.get("/api/audit", requireAdmin, (_req, res) => {
  const lines = fs.existsSync(auditFile) ? fs.readFileSync(auditFile, "utf8").trim().split(/\r?\n/).filter(Boolean).slice(-100) : [];
  res.json({ events: lines.map(line => { try { const { at, action, ...data } = JSON.parse(line); return { at, action, ...data }; } catch { return null; } }).filter(Boolean).reverse() });
});

app.use((err, _req, res, _next) => {
  if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "File is too large. The limit is 8 MB for documents and 32 MB for an internal corpus." });
  res.status(400).json({ error: "Request could not be processed." });
});

app.listen(port, host, () => {
  console.log(`NeonVision Admin is local-only: http://${host}:${port}`);
  console.log(`Private admin data directory: ${dataDir}`);
  if (!authConfig()) console.log("First visit: create a strong admin password. The password hash stays in the local data directory.");
});
