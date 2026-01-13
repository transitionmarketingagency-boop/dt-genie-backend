import { spawn, execSync } from "child_process";
import { getRelevantChunks } from "../db/vectorStore.js";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";

/* ---------------- ESM-safe __dirname ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ---------------- Python binary fix for Render ---------------- */
process.env.PYTHON_BIN =
  process.env.RENDER === "true"
    ? "/opt/render/project/src/.venv/bin/python"
    : "python";

/* ---------------- Import identity helpers ---------------- */
const { enforceBotName, getPromptEmbedding } = await import(
  pathToFileURL(join(__dirname, "../system/identity.js")).href
);

/* ---------------- Helper: Check if command exists ---------------- */
function commandExists(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/* ---------------- Gemma response generator ---------------- */
export async function generateGemma(prompt: string): Promise<string> {
  try {
    /* ---- Embed user prompt ---- */
    const embedding = await getPromptEmbedding(prompt);

    if (!Array.isArray(embedding)) {
      throw new Error("Invalid embedding returned from Python");
    }

    /* ---- Fetch relevant DB context ---- */
    const contextChunks = await getRelevantChunks(embedding, 5);
    const context = contextChunks.map((c) => c.content).join("\n\n");

    /* ---- Build final prompt for Gemma ---- */
    const finalPrompt = `
You are a professional digital marketing and growth strategist.

Use the information below if it is relevant.
If not, answer clearly and helpfully using your expertise.

Information:
${context || "No internal context available."}

User question:
${prompt}

Answer:
`.trim();

    /* ---- If Ollama exists, use Gemma ---- */
    if (commandExists("ollama")) {
      const response = await runGemma(finalPrompt);
      return enforceBotName(response, prompt);
    }

    /* ---- Safe fallback (NO branding, NO echoing) ---- */
    const fallbackResponse = context
      ? context.slice(0, 600)
      : "Could you please provide a bit more detail so I can help you properly?";

    return enforceBotName(fallbackResponse, prompt);
  } catch (err: any) {
    console.error("⚠️ generateGemma error:", err?.message);
    return enforceBotName(
      "Something went wrong while processing your request. Please try again.",
      prompt
    );
  }
}

/* ---------------- Spawn Ollama Gemma ---------------- */
function runGemma(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const gemma = spawn("ollama", ["run", "gemma", "--verbose=false"], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    let output = "";
    let error = "";

    gemma.stdout.on("data", (d) => (output += d.toString()));
    gemma.stderr.on("data", (d) => (error += d.toString()));

    const timeout = setTimeout(() => {
      gemma.kill("SIGTERM");
      reject(new Error("Gemma timeout after 60 seconds"));
    }, 60_000);

    gemma.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0 && !output.trim()) {
        reject(new Error(error || "Gemma error"));
      } else {
        resolve(output.trim());
      }
    });

    gemma.stdin.write(prompt);
    gemma.stdin.end();
  });
}

/* ---------------- Backward compatibility ---------------- */
export const gemmaClient = generateGemma;
