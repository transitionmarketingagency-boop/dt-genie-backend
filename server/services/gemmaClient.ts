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

/* ---------------- Import system identity ---------------- */
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

/* ---------------- Gemma live runner ---------------- */
export async function generateGemma(prompt: string): Promise<string> {
  try {
    // Get prompt embedding
    const embedding = await getPromptEmbedding(prompt, {
      basePath: join(__dirname, "../utils/embed_prompt.py"),
    });

    if (!Array.isArray(embedding))
      throw new Error("Invalid embedding returned from Python");

    // Fetch top relevant chunks from DB
    const contextChunks = await getRelevantChunks(embedding, 5);
    const context = contextChunks.map((c) => c.content).join("\n\n");

    // Determine if simple (greetings / short queries)
    const isSimpleQuery = prompt.trim().length <= 20;

    // Build dynamic final prompt
    let finalPrompt: string;
    if (isSimpleQuery) {
      // Use DB context if available
      finalPrompt = context
        ? `Answer the question concisely using the following information:\n${context}\nQuestion: ${prompt}`
        : `Answer the question concisely: ${prompt}`;
      return enforceBotName(finalPrompt);
    }

    // Complex queries → include context dynamically
    finalPrompt = `
Use the following information to answer the question professionally and concisely:
${context || "No additional context available."}

Question:
${prompt}

Answer:
`.trim();

    // Call Ollama Gemma only if available
    if (commandExists("ollama")) {
      return await runGemma(finalPrompt);
    } else {
      return enforceBotName(finalPrompt);
    }
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
      if (code !== 0 && !output.trim())
        reject(new Error(error || "Gemma error"));
      else resolve(enforceBotName(output.trim()));
    });

    gemma.stdin.write(prompt);
    gemma.stdin.end();
  });
}

/* ---------------- Backward compatibility ---------------- */
export const gemmaClient = generateGemma;
