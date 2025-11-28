// server/services/gemini.ts

<<<<<<< HEAD
=======
// Node 18+ includes global fetch, so no import needed.
// Uncomment the next line if using Node <18
// import fetch from "node-fetch";

>>>>>>> f71e4e4 (Rename gemini.js to gemini.ts)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("⚠️ Warning: GEMINI_API_KEY is not set in environment variables.");
}

<<<<<<< HEAD
<<<<<<< HEAD
=======
// TypeScript interface for Gemini API response
=======
>>>>>>> aca607f (Update gemini.ts)
export interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

<<<<<<< HEAD
// Main function to query Gemini API
>>>>>>> f71e4e4 (Rename gemini.js to gemini.ts)
=======
// Unified queryGemini function (TypeScript + Node 18+)
>>>>>>> aca607f (Update gemini.ts)
export async function queryGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    return "Error: Gemini API key missing.";
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
    GEMINI_API_KEY;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    return (
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "No response received from Gemini 2.5 Flash."
    );
  } catch (err) {
    console.error("❌ Gemini request failed:", err);
    return "Gemini API error — please try again.";
  }
}

