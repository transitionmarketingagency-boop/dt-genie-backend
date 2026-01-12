import { spawn } from "child_process";
import path from "path";
import { getRelevantChunks } from "../db/vectorStore.js";

export async function generateGemma(prompt: string): Promise<string> {
  try {
    const contextChunks = await getRelevantChunks(prompt);
    const context = contextChunks.map(c => c.content).join("\n\n");

    // ⚠️ OUTPUT CONSTRAINT ONLY — NO LOGIC CHANGE
    const finalPrompt = `
You are Neon Vision, the AI strategist and digital intelligence system for Digital Transition Marketing.

Instructions:
- Answer the user's question clearly and concisely
- DO NOT repeat raw website content
- DO NOT dump internal context
- DO NOT expose knowledge base text
- ONLY return the final answer

Context:
${context}

User question:
${prompt}

Answer:
`.trim();

    return await runGemma(finalPrompt);
  } catch (err) {
    console.error("⚠️ generateGemma error:", err);
    return "Neon Vision: I’m here to help, but something went wrong.";
  }
}

function runGemma(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const gemma = spawn("ollama", ["run", "gemma"], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true
    });

    let output = "";
    let error = "";

    gemma.stdout.on("data", d => (output += d.toString()));
    gemma.stderr.on("data", d => (error += d.toString()));

    gemma.on("close", code => {
      if (code !== 0) {
        reject(error);
      } else {
        resolve(output.trim());
      }
    });

    gemma.stdin.write(prompt);
    gemma.stdin.end();
  });
}
