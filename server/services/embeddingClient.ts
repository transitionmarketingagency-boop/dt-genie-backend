import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use virtual env Python, fallback to system Python if missing
const PYTHON_PATH = path.resolve(__dirname, "../../.venv/Scripts/python.exe");
const SCRIPT_PATH = path.resolve(__dirname, "../embeddings.py");

export async function getEmbedding(text: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    if (!text || !text.trim()) return resolve([]);

    execFile(
      PYTHON_PATH,
      [SCRIPT_PATH, "--text", text],
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }, // increased buffer for long input
      (error, stdout, stderr) => {
        if (error) {
          console.error("⚠️ Embedding process error:", error);
          return reject(error);
        }
        if (stderr && stderr.trim()) console.warn("⚠️ Embedding stderr:", stderr);

        try {
          const clean = stdout.trim();
          const parsed = JSON.parse(clean);
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

// Alias for consistency
export { getEmbedding as embedText };
