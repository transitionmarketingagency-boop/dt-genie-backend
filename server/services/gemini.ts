const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("⚠️ Warning: GEMINI_API_KEY is not set in environment variables.");
}

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
        parts: [{ text: prompt }]
      }
    ]
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
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