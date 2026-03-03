// server/services/json_loader.ts
import fs from "fs";
import path from "path";

export interface AIIntent {
  triggers: string[];
  responses: string[];
}

// Master array
export const aiIntents: AIIntent[] = [];

/**
 * Validate intent structure strictly
 */
function isValidIntent(obj: any): obj is AIIntent {
  return (
    obj &&
    Array.isArray(obj.triggers) &&
    Array.isArray(obj.responses) &&
    obj.triggers.every((t: any) => typeof t === "string" && t.trim().length > 0) &&
    obj.responses.every((r: any) => typeof r === "string" && r.trim().length > 0)
  );
}

/**
 * Recursively scan directory and collect all JSON files
 */
function getAllJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  let files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Load AI intents from a single JSON file
 */
function loadIntentsFromFile(filePath: string) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      parsed.forEach((item: any) => {
        if (item?.examples && typeof item.response === "string") {
          aiIntents.push({ triggers: item.examples, responses: [item.response] });
        } else if (isValidIntent(item)) {
          aiIntents.push(item);
        }
      });
    } else if (parsed?.examples && typeof parsed.response === "string") {
      aiIntents.push({ triggers: parsed.examples, responses: [parsed.response] });
    } else if (isValidIntent(parsed)) {
      aiIntents.push(parsed);
    } else {
      console.warn(`⚠️ Ignored invalid AI intent file: ${filePath}`);
    }
  } catch (err) {
    console.warn(`⚠️ Failed to parse AI intent JSON: ${filePath}`, err);
  }
}

/**
 * Load all AI intents from a base directory recursively
 */
export function loadAIIntents(baseDir: string) {
  const allFiles = getAllJsonFiles(baseDir);
  console.log(`[Loader] Found ${allFiles.length} JSON files in AI logic dir.`);

  for (const file of allFiles) {
    loadIntentsFromFile(file);
  }
}

/**
 * Initialize intents manually (call from server start)
 */
export function initializeAIIntents() {
  aiIntents.length = 0; // prevent duplication

  // Resolve dist folder automatically
  const baseDir = process.cwd();
  const aiLogicDir = path.join(baseDir, "dist", "server", "ai_logic");

  console.log(`[Loader] Loading AI intents from: ${aiLogicDir}`);
  loadAIIntents(aiLogicDir);

  console.log(`✅ Total valid AI intents loaded: ${aiIntents.length}`);
}
