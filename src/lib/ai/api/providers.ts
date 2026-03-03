import { getOAuthCredentials, storeOAuthCredentials } from "@/lib/ai/oauth-storage";
import { refreshAccessToken } from "@/lib/ai/oauth-providers";
import { runOpenAiPrompt } from "./openai";
import { runAnthropicPrompt } from "./anthropic";
import { runGooglePrompt } from "./google";

export async function runOAuthProviderPrompt(
  providerKey: string,
  userId: string,
  prompt: string
): Promise<string> {
  const creds = await getOAuthCredentials(userId);
  if (!creds) {
    throw new Error("No OAuth credentials found for user");
  }

  if (creds.providerKey !== providerKey) {
    throw new Error(`OAuth credentials found for ${creds.providerKey}, but requested ${providerKey}`);
  }

  let accessToken = creds.accessToken;

  // Check if token is expired (with 5 minute buffer)
  if (creds.expiresAt && new Date(creds.expiresAt).getTime() - 300000 < Date.now()) {
    if (!creds.refreshToken) {
      throw new Error("Access token expired and no refresh token available");
    }

    try {
      const tokens = await refreshAccessToken(providerKey, creds.refreshToken);
      accessToken = tokens.accessToken;
      
      await storeOAuthCredentials(
        userId,
        providerKey,
        tokens.accessToken,
        tokens.refreshToken || creds.refreshToken, // Keep old refresh token if not rotated
        tokens.expiresInSeconds,
        tokens.scopes
      );
    } catch (error) {
      console.error("Failed to refresh token:", error);
      throw new Error("Failed to refresh access token. Please reconnect your account.");
    }
  }

  switch (providerKey) {
    case "openai":
      return runOpenAiPrompt(accessToken, prompt);
    case "anthropic":
      return runAnthropicPrompt(accessToken, prompt);
    case "google":
      return runGooglePrompt(accessToken, prompt);
    default:
      throw new Error(`OAuth provider not supported: ${providerKey}`);
  }
}
