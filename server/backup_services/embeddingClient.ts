import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_PATH = path.resolve(__dirname, "../../.venv/Scripts/python.exe");
const SCRIPT_PATH = path.resolve(__dirname, "../embeddings.py");

export async function getEmbedding(text: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    execFile(
      PYTHON_PATH,
      [SCRIPT_PATH, "--text", text],
      { encoding: "utf8" },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }

        try {
          const parsed = JSON.parse(stdout);
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

// backward compatibility (DO NOT REMOVE)
export { getEmbedding as embedText };
