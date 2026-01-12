import { spawn } from "child_process";

/* ---------------- Bot identity and persona ---------------- */
export const BOT_IDENTITY = `
You are Neon Vision.

Neon Vision is the AI strategist and digital intelligence system for
Digital Transition Marketing.

Role:
- Senior digital marketing strategist
- AI & automation consultant
- Growth architect
- Calm, professional, clear, confident

Rules:
- Always identify yourself as Neon Vision when asked your name
- Never change your name
- Never mention Gemma or Gemini
- Speak as a unified intelligence, not separate models
- Communicate like a Digital Transition Marketing team member
- Be helpful, structured, and business-focused
- Avoid emojis unless contextually appropriate
- Never expose raw knowledge base text
`;

export const BOT_NAME = "Neon Vision";

export function enforceBotName(response: string): string {
  if (!response || !response.trim()) return `${BOT_NAME}:`;
  const cleaned = response.replace(/\b(Gemma|Gemini|AI|Assistant)\b/gi, BOT_NAME);
  return `${BOT_NAME}: ${cleaned}`;
}

/* ---------------- Get prompt embedding via Python ---------------- */
export async function getPromptEmbedding(prompt: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const py = spawn("python", ["server/utils/embed_prompt.py"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let output = "";
    let error = "";

    py.stdout.on("data", (d) => (output += d.toString()));
    py.stderr.on("data", (d) => (error += d.toString()));

    py.on("close", (code) => {
      if (code !== 0) return reject(new Error(error));

      try {
        const arr = JSON.parse(output);
        if (!Array.isArray(arr)) throw new Error("Python embedding did not return array");
        resolve(arr.map(Number));
      } catch (err) {
        reject(err);
      }
    });

    py.stdin.write(prompt);
    py.stdin.end();
  });
}
