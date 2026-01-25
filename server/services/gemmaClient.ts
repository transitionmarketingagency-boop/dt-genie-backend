import { spawn, execSync } from "child_process";
import { enforceBotName } from "../system/identity.js";

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
  // Fast exit if Ollama not installed
  if (!commandExists("ollama")) return "";

  try {
    const finalPrompt = `
You are Neon Vision, senior digital marketing & growth strategist.

Answer clearly, professionally, and confidently.
Do not ask the user to clarify unless absolutely necessary.

User question:
${prompt}

Answer:
`.trim();

    const response = await runGemma(finalPrompt);
    return enforceBotName(response);
  } catch (err: any) {
    console.error("⚠️ Gemma failed:", err?.message || err);
    return "";
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
      reject(new Error("Gemma timeout"));
    }, 30_000);

    gemma.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0 || !output.trim()) reject(new Error(error || "Gemma error"));
      else resolve(output.trim());
    });

    gemma.stdin.write(prompt);
    gemma.stdin.end();
  });
}

/* ---------------- Backward compatibility ---------------- */
export const gemmaClient = generateGemma;
