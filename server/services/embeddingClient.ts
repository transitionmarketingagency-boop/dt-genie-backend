// server/services/embeddingClient.ts
import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Flexible: check if PYTHON_PATH exists, fallback to system python
const PYTHON_PATH = path.resolve(__dirname, "../../.venv/Scripts/python.exe");
const SCRIPT_PATH = path.resolve(__dirname, "../embeddings.py");

export async function getEmbedding(text: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    if (!text || !text.trim()) return resolve([]);

    execFile(
      PYTHON_PATH,
      [SCRIPT_PATH, "--text", text],
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }, // increase buffer for long inputs
      (error, stdout, stderr) => {
        if (error) {
          console.error("Embedding process error:", error);
          return reject(error);
        }
        if (stderr && stderr.trim()) console.warn("Embedding stderr:", stderr);

        try {
          const clean = stdout.trim();
          const parsed = JSON.parse(clean);
          if (!Array.isArray(parsed) || !parsed.every(n => typeof n === "number")) {
            throw new Error("Embedding response invalid: not a number array");
          }
          resolve(parsed);
        } catch (err) {
          console.error("Failed to parse embedding output:", stdout);
          reject(err);
        }
      }
    );
  });
}

export { getEmbedding as embedText };
