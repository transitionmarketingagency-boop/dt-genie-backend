import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ES module __dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure memory folder exists
const memoryDir = path.join(__dirname, "../memory");
if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });

// Memory file paths
const sessionFile = path.join(memoryDir, "sessionMemory.json");
const userFile = path.join(memoryDir, "userMemory.json");

// Initialize empty JSON files if they don't exist
if (!fs.existsSync(sessionFile)) fs.writeFileSync(sessionFile, "{}", "utf8");
if (!fs.existsSync(userFile)) fs.writeFileSync(userFile, "{}", "utf8");

// Safe JSON read
function readJson(filePath: string) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

// Safe JSON write
function writeJson(filePath: string, data: any) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

// Short-term session memory (limit last 20 entries)
export function getSessionMemory(sessionId: string) {
  const allSessions = readJson(sessionFile);
  return allSessions[sessionId] || [];
}

export function appendSessionMemory(sessionId: string, entry: any) {
  const allSessions = readJson(sessionFile);
  if (!allSessions[sessionId]) allSessions[sessionId] = [];
  allSessions[sessionId].push(entry);
  // Keep only last 20
  allSessions[sessionId] = allSessions[sessionId].slice(-20);
  writeJson(sessionFile, allSessions);
}

// Long-term user memory (limit last 100 entries)
export function getUserMemory(userId: string) {
  const allUsers = readJson(userFile);
  return allUsers[userId] || [];
}

export function appendUserMemory(userId: string, entry: any) {
  const allUsers = readJson(userFile);
  if (!allUsers[userId]) allUsers[userId] = [];
  allUsers[userId].push(entry);
  // Keep only last 100
  allUsers[userId] = allUsers[userId].slice(-100);
  writeJson(userFile, allUsers);
}

// Export wrapper
export const memoryClient = {
  getSessionMemory,
  appendSessionMemory,
  getUserMemory,
  appendUserMemory,
};
