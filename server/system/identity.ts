import { spawn } from "child_process";

/* ---------------- Bot name (single source of truth) ---------------- */
export const BOT_NAME = "Neon Vision";

/**
 * Enforce branding ONLY when the user explicitly asks
 * Never inject name otherwise
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

  // Remove accidental model mentions (defensive)
  cleaned = cleaned.replace(/\b(Gemma|Gemini|LLM|AI model)\b/gi, "");

  if (askedIdentity) {
    return `${BOT_NAME}: ${cleaned}`;
  }

  return cleaned;
}

/* ---------------- Get prompt embedding via Python ---------------- */
export async function getPromptEmbedding(prompt: string): Promise<number[]> {
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
        resolve(arr.map(Number));
      } catch (err) {
        reject(err);
      }
    });

    py.stdin.write(prompt);
    py.stdin.end();
  });
}
