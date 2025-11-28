// server/services/gemini.ts

<<<<<<< HEAD
=======
// Node 18+ includes global fetch, so no import needed.
// If running on Node 16, uncomment the next line:
// import fetch from "node-fetch";

>>>>>>> f71e4e4 (Rename gemini.js to gemini.ts)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("⚠️ Warning: GEMINI_API_KEY is not set in environment variables.");
}

<<<<<<< HEAD
=======
// TypeScript interface for Gemini API response
export interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    output?: string; // fallback for older API response shape
  }>;
}

// Main function to query Gemini API
>>>>>>> f71e4e4 (Rename gemini.js to gemini.ts)
export async function queryGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    return "Error: Gemini API key missing.";
  }

  // Modern Gemini 2.5 API endpoint
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

    // Return text if available
    return (
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      data?.candidates?.[0]?.output ??
      "No response received from Gemini."
    );
  } catch (err) {
    console.error("❌ Gemini request failed:", err);
    return "Gemini API error — please try again.";
  }
}

