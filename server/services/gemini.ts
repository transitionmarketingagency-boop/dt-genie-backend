import fetch from "node-fetch";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function queryGemini(prompt) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generate",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: { text: prompt },
        temperature: 0.7,
        candidate_count: 1
      })
    }
  );

  const data = await response.json();

  if (!data.candidates || !data.candidates[0])
    return "I'm having trouble generating a response right now.";

  return data.candidates[0].output;
}
