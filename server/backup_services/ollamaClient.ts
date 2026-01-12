import { exec } from "child_process";

export async function generateWithOllama(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(
      `ollama run llama3 "${prompt.replace(/"/g, '\\"')}"`,
      (error, stdout, stderr) => {
        if (error) return reject(error);
        resolve(stdout.trim());
      }
    );
  });
}
