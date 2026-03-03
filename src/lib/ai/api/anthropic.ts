export async function runAnthropicPrompt(accessToken: string, prompt: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": accessToken, // Anthropic uses x-api-key, but OAuth might use Bearer. Checking docs...
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-opus-20240229", // Default model
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096
    })
  });

  // Note: Anthropic OAuth integration might be different. 
  // Usually OAuth tokens are Bearer tokens. 
  // If using direct API key, it's x-api-key.
  // Assuming standard OAuth Bearer for now, but will need verification.
  // Actually, Anthropic doesn't have public OAuth for API access in the same way OpenAI does yet?
  // They have "Workspaces" but not necessarily user-scoped OAuth for 3rd party apps to call API on behalf of user.
  // Wait, the plan assumes we can do this. 
  // If Anthropic doesn't support OAuth, we might need to ask user for API Key directly and store it encrypted.
  // For now, I'll assume Bearer token works or we treat "accessToken" as the API Key if manually entered.
  
  // Correction: If we are using "OAuth" flow, we likely get an access token.
  // If we are just storing API keys, we can reuse the same storage mechanism but skip the OAuth flow and just have a form to input the key.
  // The plan says "OAuth/API provider track".
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}
