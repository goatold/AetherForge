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

const normalizeOptional = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
  const providerKey = normalizeOptional(body.providerKey);
  if (!providerKey) {
    return NextResponse.json({ error: "providerKey is required" }, { status: 400 });
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
  const loginUrl = normalizeOptional(body.loginUrl);

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
