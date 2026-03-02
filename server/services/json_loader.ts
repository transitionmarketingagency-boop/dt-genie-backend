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
 * Recursively load AI intents from JSON files
 */
export function loadAIIntents(dir: string) {
  if (!fs.existsSync(dir)) {
    console.warn("⚠️ AI logic directory not found:", dir);
    return;
  }

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      loadAIIntents(fullPath);
      continue;
    }

    if (!file.endsWith(".json")) continue;

    try {
      const raw = fs.readFileSync(fullPath, "utf-8");
      const parsed = JSON.parse(raw);

      // If parsed is an array of intents
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          // NEW: support your current format (examples + response)
          if (item?.examples && typeof item.response === "string") {
            aiIntents.push({
              triggers: item.examples,
              responses: [item.response],
            });
            continue;
          }

          // Support standard {triggers, responses} format too
          if (isValidIntent(item)) {
            aiIntents.push(item);
          }
        }
        continue;
      }

      // If parsed is a single object in your format
      if (parsed?.examples && typeof parsed.response === "string") {
        aiIntents.push({
          triggers: parsed.examples,
          responses: [parsed.response],
        });
        continue;
      }

      // If parsed is a single object in standard format
      if (isValidIntent(parsed)) {
        aiIntents.push(parsed);
        continue;
      }

      console.warn(`⚠️ Ignored invalid intent file: ${fullPath}`);
    } catch (err) {
      console.warn(`⚠️ Failed to load JSON: ${fullPath}`, err);
    }
  }
}

/**
 * Initialize intents manually (call from server start)
 */
export function initializeAIIntents() {
  aiIntents.length = 0; // prevent duplication

  // Use dist folder if running built server
  const baseDir = process.cwd();
  const aiLogicDir = path.join(baseDir, "dist", "server", "ai_logic");

  console.log("📥 Loading AI intents from:", aiLogicDir);

  loadAIIntents(aiLogicDir);

  console.log(`✅ Total valid AI intents loaded: ${aiIntents.length}`);
}
