import { AiProviderSession } from "./provider-session";
import { encrypt, decrypt } from "../crypto";
import { executeQuery, aiProviderSessionQueries } from "../db";

export async function storeOAuthCredentials(
  userId: string,
  providerKey: string,
  accessToken: string,
  refreshToken: string | null,
  expiresInSeconds: number | null,
  scopes: string[]
): Promise<AiProviderSession> {
  const accessTokenEnc = await encrypt(accessToken);
  const refreshTokenEnc = refreshToken ? await encrypt(refreshToken) : null;
  
  // Calculate expiresAt from expiresInSeconds (if provided)
  const expiresAt = expiresInSeconds 
    ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    : null;

  const result = await executeQuery<{
    id: string;
    user_id: string;
    provider_key: string;
    mode: "browser_ui" | "oauth_api";
    status: "connected";
    model_hint: string | null;
    login_url: string | null;
    connected_at: string | null;
    updated_at: string;
    access_token_enc: string | null;
    refresh_token_enc: string | null;
    expires_at: string | null;
    scopes: string[] | null;
    token_type: string | null;
  }>(aiProviderSessionQueries.upsertOAuthConnected(
    userId,
    providerKey,
    accessTokenEnc,
    refreshTokenEnc,
    expiresAt,
    scopes,
    "Bearer", // Defaulting to Bearer for now
    "{}" // Empty metadata
  ));

  const row = result.rows[0];
  
  return {
    id: row.id,
    userId: row.user_id,
    providerKey: row.provider_key,
    mode: row.mode,
    status: row.status,
    modelHint: row.model_hint,
    loginUrl: row.login_url,
    connectedAt: row.connected_at,
    updatedAt: row.updated_at,
    accessTokenEnc: row.access_token_enc,
    refreshTokenEnc: row.refresh_token_enc,
    expiresAt: row.expires_at,
    scopes: row.scopes,
    tokenType: row.token_type
  };
}

export async function getOAuthCredentials(
  userId: string
): Promise<{ 
  accessToken: string; 
  refreshToken: string | null; 
  expiresAt: string | null;
  providerKey: string;
} | null> {
  const result = await executeQuery<{
    provider_key: string;
    access_token_enc: string | null;
    refresh_token_enc: string | null;
    expires_at: string | null;
  }>(aiProviderSessionQueries.findConnectedByUser(userId));
  
  const row = result.rows[0];
  
  if (!row || !row.access_token_enc) {
    return null;
  }

  const accessToken = await decrypt(row.access_token_enc);
  const refreshToken = row.refresh_token_enc ? await decrypt(row.refresh_token_enc) : null;

  return {
    accessToken,
    refreshToken,
    expiresAt: row.expires_at,
    providerKey: row.provider_key
  };
}
