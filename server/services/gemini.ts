const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function queryGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY missing");
    return "API key missing";
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
    GEMINI_API_KEY;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ]
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  try {
    return (
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "No response from Gemini 2.5 Flash"
    );
  } catch (err) {
    console.error("Gemini parse error", err);
    return "Error parsing Gemini response";
  }
}

