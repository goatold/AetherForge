export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  openai: {
    clientId: process.env.OPENAI_CLIENT_ID || "",
    clientSecret: process.env.OPENAI_CLIENT_SECRET || "",
    authUrl: "https://platform.openai.com/oauth/authorize", // Hypothetical/Example URL
    tokenUrl: "https://api.openai.com/oauth/token", // Hypothetical/Example URL
    scopes: ["model.read", "model.request"]
  },
  anthropic: {
    clientId: process.env.ANTHROPIC_CLIENT_ID || "",
    clientSecret: process.env.ANTHROPIC_CLIENT_SECRET || "",
    authUrl: "https://console.anthropic.com/oauth/authorize", // Hypothetical
    tokenUrl: "https://api.anthropic.com/oauth/token", // Hypothetical
    scopes: []
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/generative-language.retriever"]
  }
};

export function getAuthorizationUrl(providerKey: string, state: string, redirectUri: string): string {
  const config = OAUTH_PROVIDERS[providerKey];
  if (!config) {
    throw new Error(`Unknown OAuth provider: ${providerKey}`);
  }
  if (!config.clientId) {
    throw new Error(`Missing client ID for provider: ${providerKey}`);
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state: state,
    access_type: "offline", // Request refresh token
    prompt: "consent" // Force consent to ensure refresh token
  });

  return `${config.authUrl}?${params.toString()}`;
}

export async function exchangeCode(
  providerKey: string,
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number | null;
  scopes: string[];
}> {
  const config = OAUTH_PROVIDERS[providerKey];
  if (!config) {
    throw new Error(`Unknown OAuth provider: ${providerKey}`);
  }
  if (!config.clientId || !config.clientSecret) {
    throw new Error(`Missing client credentials for provider: ${providerKey}`);
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange code for token: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresInSeconds: data.expires_in || null,
    scopes: data.scope ? data.scope.split(" ") : config.scopes
  };
}

export async function refreshAccessToken(
  providerKey: string,
  refreshToken: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number | null;
  scopes: string[];
}> {
  const config = OAUTH_PROVIDERS[providerKey];
  if (!config) {
    throw new Error(`Unknown OAuth provider: ${providerKey}`);
  }
  if (!config.clientId || !config.clientSecret) {
    throw new Error(`Missing client credentials for provider: ${providerKey}`);
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null, // Some providers rotate refresh tokens
    expiresInSeconds: data.expires_in || null,
    scopes: data.scope ? data.scope.split(" ") : config.scopes
  };
}
