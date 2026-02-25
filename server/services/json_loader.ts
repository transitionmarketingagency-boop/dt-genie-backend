// server/services/json_loader.ts
import fs from "fs";
import path from "path";

export interface AIIntent {
  triggers: string[];
  responses: string[];
}

// Master array of all loaded intents
export const aiIntents: AIIntent[] = [];

/**
 * Recursively load AI intents from JSON files
 * Supports both structured (triggers/responses) and raw JSON
 */
export function loadAIIntents(dir: string) {
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir);
  for (const f of files) {
    const fullPath = path.join(dir, f);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      loadAIIntents(fullPath); // ✅ recurse into subfolders
    } else if (f.endsWith(".json")) {
      try {
        const json = JSON.parse(fs.readFileSync(fullPath, "utf-8"));

        // Check if JSON has triggers/responses
        if (Array.isArray(json.triggers) && Array.isArray(json.responses)) {
          aiIntents.push(json);
        } else if (Array.isArray(json)) {
          // If JSON is an array of objects, merge all items
          for (const item of json) {
            if (item.triggers && item.responses) {
              aiIntents.push(item);
            } else {
              // fallback: keep raw JSON string as response
              aiIntents.push({ triggers: [], responses: [JSON.stringify(item)] });
            }
          }
        } else {
          // Fallback: push raw JSON as a single response
          aiIntents.push({ triggers: [], responses: [JSON.stringify(json)] });
        }
      } catch (err) {
        console.warn(`⚠️ Failed to load JSON: ${fullPath}`, err);
      }
    }
  }
}

// ✅ Correct root folder for AI logic
const aiLogicDir = path.join(process.cwd(), "server", "ai_logic");
console.log(" ~B Loading AI intents from:", aiLogicDir);

loadAIIntents(aiLogicDir);

console.log(`✅ Total AI intents loaded from JSON files: ${aiIntents.length}`);
