// scripts/generateChunkIntents.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHUNKS_FILE = path.join(process.cwd(), "server", "vector_store", "chunks.json");
const OUTPUT_DIR = path.join(process.cwd(), "server", "ai_logic_converted", "auto_chunks");

// Create folder if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Load chunks
const rawChunks = fs.readFileSync(CHUNKS_FILE, "utf-8");
const chunks: { text: string; source?: string; embedding: number[] }[] = JSON.parse(rawChunks);

// Generate intents
chunks.forEach((chunk, index) => {
  const text = chunk.text || "";
  if (!text || text.length < 20) return; // skip tiny chunks

  // Create simple triggers: keywords from chunk + service/feature phrases
  const triggers = [];
  const lower = text.toLowerCase();

  if (lower.includes("cgi")) triggers.push("cgi ads", "cgi property tours");
  if (lower.includes("youtube")) triggers.push("youtube ads", "youtube ads pricing");
  if (lower.includes("email")) triggers.push("email marketing", "email automation");
  if (lower.includes("automation")) triggers.push("marketing automation", "automated marketing");
  if (lower.includes("pilot")) triggers.push("pilot offer", "trial campaign");
  if (lower.includes("case study")) triggers.push("case studies", "success stories");
  if (triggers.length === 0) triggers.push("general service");

  const intent = {
    triggers,
    responses: [text],
    source: chunk.source || "chunk_auto"
  };

  const filename = `chunk_intent_${index + 1}.json`;
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), JSON.stringify(intent, null, 2), "utf-8");
});

console.log(`✅ Generated ${chunks.length} chunk-based AI intents in ${OUTPUT_DIR}`);
