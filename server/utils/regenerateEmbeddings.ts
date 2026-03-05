// server/utils/regenerateEmbeddings.ts
import fs from "fs";
import path from "path";
import { getEmbedding } from "../services/openRouterEmbeddingsClient.js"; // ✅ new client

// ================= ENV CHECK =================
if (!process.env.OPENROUTER_API_KEY) {
  console.error("❌ OPENROUTER_API_KEY is NOT defined. Exiting.");
  process.exit(1);
}

// ================= PATHS =================
const chunksFilePath = path.resolve("server/vector_store/chunks.json");
const embCachePath = path.resolve("server/vector_store/.queryEmbCache.json");

// ================= LOAD CHUNKS =================
interface Chunk {
  text: string;
  source: string | null;
  embedding: number[];
}

function loadChunks(): Chunk[] {
  if (!fs.existsSync(chunksFilePath)) {
    console.error("chunks.json not found at:", chunksFilePath);
    return [];
  }
  const raw = fs.readFileSync(chunksFilePath, "utf-8");
  const parsed = JSON.parse(raw);
  return parsed.map((c: any) => ({
    text: String(c.text),
    source: typeof c.source === "string" ? c.source : null,
    embedding: Array.isArray(c.embedding) ? c.embedding.map(Number) : [],
  }));
}

// ================= EMBEDDING CACHE =================
let embCache: Record<string, number[]> = {};
if (fs.existsSync(embCachePath)) {
  try {
    embCache = JSON.parse(fs.readFileSync(embCachePath, "utf-8"));
    console.log("✅ Loaded embedding cache");
  } catch (err) {
    console.warn("⚠️ Failed to load embedding cache:", err);
  }
}

function saveEmbCache() {
  fs.writeFileSync(embCachePath, JSON.stringify(embCache, null, 2), "utf-8");
  console.log("✅ Saved embedding cache");
}

// ================= REGENERATE ALL CHUNKS =================
async function regenerateAllEmbeddings() {
  const chunks = loadChunks();
  if (!chunks.length) return;

  console.log(`🔹 Regenerating embeddings for ${chunks.length} chunks...`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const key = chunk.text.slice(0, 100); // cache key

    if (embCache[key]) {
      chunk.embedding = embCache[key];
      continue;
    }

    try {
      const emb = await getEmbedding(chunk.text); // ✅ use new OpenRouter client
      chunk.embedding = emb;
      embCache[key] = emb;
      console.log(`✅ Chunk ${i + 1}/${chunks.length} embedded`);
    } catch (err) {
      console.error(`❌ Failed to embed chunk ${i + 1}:`, err);
    }
  }

  // Save updated chunks and cache
  fs.writeFileSync(chunksFilePath, JSON.stringify(chunks, null, 2), "utf-8");
  console.log("✅ Updated chunks.json with new embeddings");
  saveEmbCache();
}

// ================= RUN =================
regenerateAllEmbeddings().then(() => {
  console.log("🎉 All embeddings regenerated with Qwen 4B");
  process.exit(0);
});
