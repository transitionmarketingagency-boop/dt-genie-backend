import fs from "fs";
import path from "path";

// Corrected persona path
const personaPath = path.join(
  process.cwd(),
  "knowledge_base",
  "persona",
  "system_persona.json"
);
const persona = JSON.parse(fs.readFileSync(personaPath, "utf-8"));

// Simple role detection based on keywords
export function detectRole(userInput: string): "sales" | "support" | "marketing" {
  const text = userInput.toLowerCase();

  if (/price|cost|strategy call|quote|timeline|lead/.test(text)) {
    return "sales";
  }
  if (/faq|support|help|project process|clarify/.test(text)) {
    return "support";
  }
  if (/growth|marketing strategy|automation|ai tools|performance/.test(text)) {
    return "marketing";
  }
  return "support"; // default
}

// Get role rules
export function getRoleRules(role: "sales" | "support" | "marketing") {
  return persona.roles[role];
}
