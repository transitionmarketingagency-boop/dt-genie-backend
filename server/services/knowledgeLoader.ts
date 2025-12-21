// server/services/knowledgeLoader.ts

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to knowledge base folder
const KNOWLEDGE_BASE_PATH = path.resolve(
  __dirname,
  "../knowledge-base"
);

// Load all .txt / .md files from knowledge base
export function loadKnowledge(): string {
  if (!fs.existsSync(KNOWLEDGE_BASE_PATH)) {
    return "No knowledge base found.";
  }

  const files = fs.readdirSync(KNOWLEDGE_BASE_PATH);

  let combinedKnowledge = "";

  for (const file of files) {
    if (!file.endsWith(".txt") && !file.endsWith(".md")) continue;

    const filePath = path.join(KNOWLEDGE_BASE_PATH, file);
    const content = fs.readFileSync(filePath, "utf-8");

    combinedKnowledge += `
--- FILE: ${file} ---
${content}
`;
  }

  return combinedKnowledge.trim();
}
