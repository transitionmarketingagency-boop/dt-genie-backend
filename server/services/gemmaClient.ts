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

    // Fetch top relevant chunks from database
    const contextChunks = await getRelevantChunks(promptEmbedding, 5);
    const context = contextChunks.map((c) => c.content).join("\n\n");

    // Minimal prompt wrapper for simple queries
    const isSimpleQuery = prompt.trim().length < 20; // greetings, short questions
    const finalPrompt = isSimpleQuery
      ? prompt
      : `
${BOT_IDENTITY}

Context:
${context || "No additional context."}

Question:
${prompt}

Answer (provide clear, professional, structured response):
`.trim();

    // Fallback if Ollama Gemma is not available
    if (process.platform === "win32" || !commandExists("ollama")) {
      // Simple query → short, professional response
      if (isSimpleQuery) {
        return enforceBotName(
          `Hello! I’m here to help you with Digital Transition Marketing.`
        );
      }

      // Complex query → use database context for professional response
      const fallbackResponse = `
${BOT_IDENTITY}

Context:
${context || "No additional context."}

Answer:
[Professional response based on the context above]
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
