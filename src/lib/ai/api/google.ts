export async function runGooglePrompt(accessToken: string, prompt: string): Promise<string> {
  // Google Gemini API via Vertex AI or AI Studio
  // Using AI Studio (Generative Language API)
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}
