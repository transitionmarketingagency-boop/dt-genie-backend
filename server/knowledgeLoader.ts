import fs from "fs";
import path from "path";

/**
 * Load all Markdown files from knowledge_base recursively
 * Returns combined content as a single string
 */
export function loadKnowledge(): string {
  const KNOWLEDGE_PATH = path.join(__dirname, "../knowledge_base");

  function readFilesRecursively(dir: string): string {
    let content = "";
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        content += readFilesRecursively(fullPath) + "\n";
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        content += fs.readFileSync(fullPath, "utf-8") + "\n";
      }
    }
    return content;
  }

  try {
    return readFilesRecursively(KNOWLEDGE_PATH);
  } catch (err) {
    console.error("❌ Failed to load knowledge base:", err);
    return "";
  }
}
