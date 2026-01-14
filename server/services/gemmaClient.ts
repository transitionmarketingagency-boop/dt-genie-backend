// server/services/gemmaClient.ts

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
  // ❗ IMPORTANT:
  // Gemma is ONLY used when Ollama exists (local dev).
  // On Render, this returns empty FAST and Gemini handles it.

  if (!commandExists("ollama")) {
    return ""; // ⚡ FAST EXIT — no dumb fallback
  }

  try {
    const finalPrompt = `
You are Neon Vision, a senior digital marketing and growth strategist.

Answer clearly, professionally, and confidently.
Do not ask the user to clarify unless absolutely necessary.

User question:
${prompt}

Answer:
`.trim();

    const response = await runGemma(finalPrompt);
    return enforceBotName(response, prompt);
  } catch (err: any) {
    console.error("⚠️ Gemma failed:", err?.message);
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

    gemma.stdout.on("data", (d) => {
      output += d.toString();
    });

    gemma.stderr.on("data", (d) => {
      error += d.toString();
    });

    const timeout = setTimeout(() => {
      gemma.kill("SIGTERM");
      reject(new Error("Gemma timeout"));
    }, 30_000);

    gemma.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0 || !output.trim()) {
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
