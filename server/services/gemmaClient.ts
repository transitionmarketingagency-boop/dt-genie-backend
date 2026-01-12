import { spawn } from "child_process";
import { getRelevantChunks } from "../db/vectorStore.js";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";

/* ---------------- ESM-safe __dirname ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ---------------- Import system identity ---------------- */
const { BOT_IDENTITY, enforceBotName, getPromptEmbedding } = await import(
  pathToFileURL(join(__dirname, "../system/identity.js")).href
);

/* ---------------- Gemma live runner ---------------- */
export async function generateGemma(prompt: string): Promise<string> {
  try {
    // Compute prompt embedding via Python
    const promptEmbedding = await getPromptEmbedding(prompt);
    if (!Array.isArray(promptEmbedding))
      throw new Error("Invalid embedding returned from Python");

    // Fetch top relevant chunks using cosine similarity
    const contextChunks = await getRelevantChunks(promptEmbedding);
    const context = contextChunks.map((c) => c.content).join("\n\n");

    // Build the full prompt
    const finalPrompt = `
${BOT_IDENTITY}

Context:
${context}

User question:
${prompt}

Answer:
`.trim();

    // Windows fallback: return mock response if Ollama unavailable
    if (process.platform === "win32") {
      return enforceBotName(`[Local Neon Vision mock response] ${prompt}`);
    }

    return await runGemma(finalPrompt);
  } catch (err) {
    console.error("⚠️ generateGemma error:", err);
    return enforceBotName("I’m here to help, but something went wrong.");
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

    // Timeout safeguard: kill Gemma after 60s
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
