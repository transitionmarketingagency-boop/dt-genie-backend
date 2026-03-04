import fetch from "node-fetch";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

interface OpenRouterResponse {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
}

export async function generateOpenRouter(
  prompt: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY is NOT defined");
    return "";
  }

  console.log("✅ OPENROUTER_API_KEY detected");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://dt-genie-backend.onrender.com",
        "X-Title": "DT Genie Backend",
      },
      body: JSON.stringify({
        model: "qwen/qwen-72b-chat",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 800,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      console.error(`❌ OpenRouter HTTP ${res.status}:`, errText);
      return "";
    }

    const data = (await res.json()) as OpenRouterResponse;
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      console.error("❌ OpenRouter returned empty content");
      return "";
    }

    console.log("✅ Qwen response received");
    return content.trim();
  } catch (err: any) {
    clearTimeout(timeout);

    if (err.name === "AbortError") {
      console.error("❌ OpenRouter request timed out (25s)");
    } else {
      console.error("❌ OpenRouter request failed:", err.message);
    }

    return "";
  }
}
