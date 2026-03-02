import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import { aiProviderSessionQueries, executeQuery } from "@/lib/db";
import type { AiProviderMode } from "@/lib/ai/provider-session";
import { getConnectedAiProviderSession } from "@/lib/ai/provider-session";

interface ConnectBody {
  providerKey?: string;
  mode?: AiProviderMode;
  modelHint?: string | null;
  loginUrl?: string | null;
}

const isMode = (value: unknown): value is AiProviderMode =>
  value === "browser_ui" || value === "oauth_api";

const SUPPORTED_PROVIDER_KEYS = new Set(["chatgpt-web", "claude-web", "gemini-web"]);
const MAX_MODEL_HINT_LENGTH = 120;
const PROVIDER_LOGIN_URLS: Record<string, string> = {
  "chatgpt-web": "https://chatgpt.com",
  "claude-web": "https://claude.ai",
  "gemini-web": "https://gemini.google.com"
};

const normalizeOptional = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeProviderKey = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  return value.length > 0 ? value : null;
};

const isModelHintValid = (modelHint: string): boolean =>
  /^[A-Za-z0-9._:/ -]+$/.test(modelHint);

const isAllowedLoginUrl = (providerKey: string, loginUrl: string | null): boolean => {
  if (!loginUrl) {
    return false;
  }
  const expectedUrl = PROVIDER_LOGIN_URLS[providerKey];
  if (!expectedUrl) {
    return false;
  }
  try {
    const parsedLoginUrl = new URL(loginUrl);
    return (
      parsedLoginUrl.protocol === "https:" &&
      parsedLoginUrl.search.length === 0 &&
      parsedLoginUrl.hash.length === 0 &&
      loginUrl === expectedUrl
    );
  } catch {
    return false;
  }
};

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const connected = await getConnectedAiProviderSession(session.userId);
  return NextResponse.json({
    connected: Boolean(connected),
    session: connected
  });
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const body = (rawBody ?? {}) as ConnectBody;
  const providerKey = normalizeProviderKey(body.providerKey);
  if (!providerKey) {
    return NextResponse.json({ error: "providerKey is required" }, { status: 400 });
  }
  if (providerKey.trim() !== providerKey) {
    return NextResponse.json(
      { error: "providerKey must not include leading or trailing whitespace." },
      { status: 400 }
    );
  }
  if (!SUPPORTED_PROVIDER_KEYS.has(providerKey)) {
    return NextResponse.json(
      {
        error:
          "providerKey is not a supported provider. Use one of: chatgpt-web, claude-web, gemini-web."
      },
      { status: 400 }
    );
  }
  if (!isMode(body.mode)) {
    return NextResponse.json({ error: "mode must be browser_ui or oauth_api" }, { status: 400 });
  }
  if (body.mode === "oauth_api") {
    return NextResponse.json(
      { error: "oauth_api mode is not yet implemented. Use browser_ui for current MVP releases." },
      { status: 400 }
    );
  }
  const modelHint = normalizeOptional(body.modelHint);
  if (modelHint && modelHint.length > MAX_MODEL_HINT_LENGTH) {
    return NextResponse.json(
      { error: `modelHint must be ${MAX_MODEL_HINT_LENGTH} characters or fewer.` },
      { status: 400 }
    );
  }
  if (modelHint && !isModelHintValid(modelHint)) {
    return NextResponse.json(
      { error: "modelHint contains unsupported characters." },
      { status: 400 }
    );
  }
  const loginUrl = normalizeOptional(body.loginUrl);
  if (!isAllowedLoginUrl(providerKey, loginUrl)) {
    return NextResponse.json(
      {
        error:
          "loginUrl must match the canonical login URL over HTTPS for the selected provider key."
      },
      { status: 400 }
    );
  }

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
  }>(
    aiProviderSessionQueries.upsertConnected(
      session.userId,
      providerKey,
      body.mode,
      modelHint,
      loginUrl,
      JSON.stringify({ source: "manual_web_login" })
    )
  );
  const connected = result.rows[0] ? await getConnectedAiProviderSession(session.userId) : null;
  return NextResponse.json({
    connected: Boolean(connected),
    session: connected
  });
}

export async function DELETE() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await executeQuery(aiProviderSessionQueries.disconnectByUser(session.userId));
  return NextResponse.json({ disconnected: true });
}
