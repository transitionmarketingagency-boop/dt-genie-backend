// server/services/openRouterClient.ts
import fetch from "node-fetch";
import { cleanResponse } from "../utils/cleanResponse.js";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_NAME = "qwen/qwen3.5-35b-a3b"; // Updated to latest Qwen 3.5 model
const TIMEOUT_MS = 30000; // 30 seconds

if (!OPENROUTER_API_KEY) {
  console.warn("⚠️ OPENROUTER_API_KEY is missing. OpenRouter requests will fail.");
}

// Define the OpenRouter response type
interface OpenRouterChoice {
  message: { role: string; content: string };
}

interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenRouterChoice[];
}

/**
 * generateOpenRouter
 * Sends a prompt to Qwen 3.5-35B-a3b via OpenRouter API and returns the cleaned text response
 */
export async function generateOpenRouter(prompt: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const body = {
      model: MODEL_NAME,
      messages: [
        { role: "system", content: "You are a helpful AI assistant specialized in marketing, automation, and digital growth strategies." },
        { role: "user", content: prompt }
      ],
      max_tokens: 1024, // increased for detailed responses
      temperature: 0.4
    };

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`⚠️ OpenRouter HTTP Error: ${res.status}`);
      return "";
    }

    const data = (await res.json()) as OpenRouterResponse;

    if (data?.choices?.[0]?.message?.content) {
      return cleanResponse(data.choices[0].message.content);
    }

    console.warn("⚠️ OpenRouter returned empty response");
    return "";
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        console.warn("⚠️ OpenRouter request timed out (30s)");
      } else {
        console.warn("⚠️ OpenRouter request failed:", err.message);
      }
    } else {
      console.warn("⚠️ OpenRouter request failed:", String(err));
    }
    return "";
  }
}
