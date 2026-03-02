import { aiProviderSessionQueries, executeQuery } from "@/lib/db";

export type AiProviderMode = "browser_ui" | "oauth_api";

export interface AiProviderSession {
  id: string;
  userId: string;
  providerKey: string;
  mode: AiProviderMode;
  status: "connected";
  modelHint: string | null;
  loginUrl: string | null;
  connectedAt: string | null;
  updatedAt: string;
}

const mapRow = (row: {
  id: string;
  user_id: string;
  provider_key: string;
  mode: AiProviderMode;
  status: "connected";
  model_hint: string | null;
  login_url: string | null;
  connected_at: string | null;
  updated_at: string;
}): AiProviderSession => ({
  id: row.id,
  userId: row.user_id,
  providerKey: row.provider_key,
  mode: row.mode,
  status: row.status,
  modelHint: row.model_hint,
  loginUrl: row.login_url,
  connectedAt: row.connected_at,
  updatedAt: row.updated_at
});

export async function getConnectedAiProviderSession(userId: string): Promise<AiProviderSession | null> {
  const result = await executeQuery<{
    id: string;
    user_id: string;
    provider_key: string;
    mode: AiProviderMode;
    status: "connected";
    model_hint: string | null;
    login_url: string | null;
    connected_at: string | null;
    updated_at: string;
  }>(aiProviderSessionQueries.findConnectedByUser(userId));
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}
