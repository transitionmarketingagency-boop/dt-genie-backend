import { spawn, execSync } from "child_process";
import { getRelevantChunks } from "../db/vectorStore.js";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";

/* ---------------- ESM-safe __dirname ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ---------------- FIX: Force correct Python on Render ---------------- */
if (process.env.RENDER === "true") {
  process.env.PYTHON_BIN = "/opt/render/project/src/.venv/bin/python";
} else {
  process.env.PYTHON_BIN = "python";
}

/* ---------------- Import system identity ---------------- */
const { BOT_IDENTITY, enforceBotName, getPromptEmbedding } = await import(
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

/* ---------------- Gemma live runner ---------------- */
export async function generateGemma(prompt: string): Promise<string> {
  try {
    // Compute prompt embedding via Python
    const promptEmbedding = await getPromptEmbedding(prompt, {
      basePath: join(__dirname, "../utils/embed_prompt.py")
    });

    if (!Array.isArray(promptEmbedding))
      throw new Error("Invalid embedding returned from Python");

    // Fetch top relevant chunks
    const contextChunks = await getRelevantChunks(promptEmbedding, 5);
    const context = contextChunks.map((c) => c.content).join("\n\n");

    // Build final prompt
    const finalPrompt = `
${BOT_IDENTITY}

Context:
${context || "No additional context."}

Question:
${prompt}

Answer (provide clear, professional response):
`.trim();

    // Windows fallback or Ollama missing
    if (
      process.platform === "win32" ||
      !commandExists("ollama")
    ) {
      // Use professional local response with context
      const fallbackResponse = `
${BOT_IDENTITY}

Context:
${context || "No additional context."}

Answer:
[Professional response generated locally]
`.trim();
      return enforceBotName(fallbackResponse);
    }

    // Call real Ollama Gemma if available
    return await runGemma(finalPrompt);
  } catch (err: any) {
    console.error("⚠️ generateGemma error:", err?.message);
    return enforceBotName(
      "I’m here to help, but something went wrong."
    );
  }
}

/* ---------------- Spawn Ollama Gemma ---------------- */
function runGemma(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const gemma = spawn("ollama", ["run", "gemma", "--verbose=false"], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true
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
      if (code !== 0 && !output.trim()) reject(new Error(error || "Gemma error"));
      else resolve(enforceBotName(output.trim()));
    });

    gemma.stdin.write(prompt);
    gemma.stdin.end();
  });
}

/* ---------------- Backward compatibility ---------------- */
export const gemmaClient = generateGemma;
