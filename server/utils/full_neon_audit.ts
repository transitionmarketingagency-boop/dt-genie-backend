import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";

// ES module safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Paths ---
const CHUNKS_FOLDER = path.join(__dirname, "../ai_logic_converted/auto_chunks");
const CONSOLIDATED_FILES = [
  path.join(__dirname, "../ai_logic_converted/neon_vision_faq_bot.json"),
  path.join(__dirname, "../ai_logic_converted/neon_vision_intents.json"),
  path.join(__dirname, "../ai_logic_converted/neon_vision_pilot_onboarding.json"),
  path.join(__dirname, "../ai_logic_converted/neon_vision_sales_advisor.json"),
  path.join(__dirname, "../ai_logic_converted/neon_vision_technical_advisor.json")
];

// --- Functions ---
function loadChunks(folder: string) {
  if (!fs.existsSync(folder)) {
    throw new Error(`Chunks folder not found: ${folder}`);
  }

  const files = fs.readdirSync(folder).filter(f => f.endsWith(".json"));
  const chunks = files.map(f => {
    const fullPath = path.join(folder, f);
    const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    return { file: f, data };
  });

  return chunks;
}

function checkChunks(chunks: { file: string, data: any }[]) {
  let valid = true;
  chunks.forEach(chunk => {
    if (!chunk.data.embedding) {
      console.log(chalk.red(`❌ Missing embedding: ${chunk.file}`));
      valid = false;
    }
  });
  return valid;
}

function checkConsolidatedFiles(files: string[]) {
  let allExist = true;
  files.forEach(f => {
    if (!fs.existsSync(f)) {
      console.log(chalk.red(`❌ Missing consolidated file: ${f}`));
      allExist = false;
    } else {
      console.log(chalk.green(`✅ Found consolidated file: ${f}`));
    }
  });
  return allExist;
}

// --- Run Audit ---
console.log(chalk.blueBright("🔹 Starting Neon Vision Full Audit..."));

let chunks: { file: string, data: any }[] = [];
try {
  chunks = loadChunks(CHUNKS_FOLDER);
  console.log(chalk.green(`✅ Vector store loaded: ${chunks.length} chunks`));
} catch (err: any) {
  console.error(chalk.red(`❌ Failed to load chunks: ${err.message}`));
  process.exit(1);
}

const chunksValid = checkChunks(chunks);
const consolidatedValid = checkConsolidatedFiles(CONSOLIDATED_FILES);

if (chunksValid && consolidatedValid) {
  console.log(chalk.greenBright("✅ Full Neon Vision Audit Completed Successfully!"));
} else {
  console.log(chalk.yellowBright("⚠️ Neon Vision Audit Completed with Warnings/Errors."));
  process.exit(1);
}
