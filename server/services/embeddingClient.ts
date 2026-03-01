// server/services/embeddingClient.ts
import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cross-platform Python detection
let PYTHON_PATH: string = process.env.PYTHON || (os.platform() === "win32" ? "python" : "python3");

// Path to embedding Python script
const SCRIPT_PATH = path.resolve(__dirname, "../utils/embed_text.py");

export async function getEmbedding(text: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    if (!text || !text.trim()) return resolve([]);

    execFile(
      PYTHON_PATH,
      [SCRIPT_PATH, "--text", text],
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          console.error("⚠️ Embedding process error:", error);
          return reject(error);
        }
        if (stderr && stderr.trim()) console.warn("⚠️ Embedding stderr:", stderr);

        try {
          const parsed = JSON.parse(stdout.trim());
          if (!Array.isArray(parsed) || !parsed.every(n => typeof n === "number")) {
            throw new Error("Embedding response invalid: not a numeric array");
          }
          resolve(parsed);
        } catch (err) {
          console.error("⚠️ Failed to parse embedding output:", stdout);
          reject(err);
        }
      }
    );
  });
}

// Alias
export { getEmbedding as embedText };
