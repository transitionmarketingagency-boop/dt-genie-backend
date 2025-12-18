import { execFile } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Current location: server/services
const PYTHON_PATH = path.resolve(__dirname, "../../.venv/Scripts/python.exe");
const SCRIPT_PATH = path.resolve(__dirname, "../embeddings.py");

export async function getEmbedding(text: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    execFile(
      PYTHON_PATH,
      [SCRIPT_PATH, "--text", text],
      { encoding: "utf8" },
      (error, stdout, stderr) => {
        if (error) return reject(error);
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}
