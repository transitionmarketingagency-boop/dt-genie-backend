import { spawn } from "child_process";

/* ---------------- Bot name (single source of truth) ---------------- */
export const BOT_NAME = "Neon Vision";

/* ---------------- Embedding cache (speed boost) ---------------- */
const embeddingCache = new Map<string, number[]>();

/**
 * Enforce branding ONLY when the user explicitly asks
 */
export function enforceBotName(
  response: string,
  userPrompt: string = ""
): string {
  if (!response || !response.trim()) return "";

  const askedIdentity =
    /who are you|your name|introduce yourself|what is your name/i.test(
      userPrompt
    );

  let cleaned = response.trim();

  // Defensive cleanup
  cleaned = cleaned.replace(/\b(Gemma|Gemini|LLM|AI model)\b/gi, "");

  if (askedIdentity) {
    return `${BOT_NAME}: ${cleaned}`;
  }

  return cleaned;
}

/* ---------------- Get prompt embedding via Python ---------------- */
export async function getPromptEmbedding(prompt: string): Promise<number[]> {
  if (embeddingCache.has(prompt)) {
    return embeddingCache.get(prompt)!;
  }

  return new Promise((resolve, reject) => {
    const pythonBin =
      process.env.RENDER === "true"
        ? "/opt/render/project/src/.venv/bin/python"
        : "python";

    const py = spawn(pythonBin, ["server/utils/embed_prompt.py"], {
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
        if (!Array.isArray(arr)) {
          throw new Error("Invalid embedding output");
        }

        const vector = arr.map(Number);
        embeddingCache.set(prompt, vector);
        resolve(vector);
      } catch (err) {
        reject(err);
      }
    });

    py.stdin.write(prompt);
    py.stdin.end();
  });
}
