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
    const embedding = await getPromptEmbedding(prompt, {
      basePath: join(__dirname, "../utils/embed_prompt.py"),
    });

    if (!Array.isArray(embedding)) {
      throw new Error("Invalid embedding returned from Python");
    }

    /* ---- Fetch relevant DB context ---- */
    const contextChunks = await getRelevantChunks(embedding, 5);
    const context = contextChunks.map((c) => c.content).join("\n\n");

    const isSimpleQuery = prompt.trim().length <= 20;

    /* ---- Build FINAL prompt (ALWAYS generates an answer) ---- */
    const finalPrompt = `
Use the following information to answer professionally and clearly.
If the information is insufficient, respond helpfully based on your expertise.

Information:
${context || "No additional internal information available."}

User question:
${prompt}

Answer:
`.trim();

    /* ---- If Ollama exists, use Gemma ---- */
    if (commandExists("ollama")) {
      const response = await runGemma(finalPrompt);
      return enforceBotName(response);
    }

    /* ---- Fallback: context-driven answer (NO echoing prompts) ---- */
    const fallbackResponse = isSimpleQuery
      ? context
        ? context.split("\n").slice(0, 2).join(" ")
        : "Hello! How can Digital Transition Marketing assist you today?"
      : context || "I’m happy to help — could you please clarify your request?";

    return enforceBotName(fallbackResponse);
  } catch (err: any) {
    console.error("⚠️ generateGemma error:", err?.message);
    return enforceBotName(
      "I’m here to help, but something went wrong. Please try again."
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
