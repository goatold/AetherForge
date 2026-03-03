import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { exchangeCode, OAUTH_PROVIDERS } from "@/lib/ai/oauth-providers";
import { storeOAuthCredentials } from "@/lib/ai/oauth-storage";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.json({ error: `OAuth error: ${error}` }, { status: 400 });
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("oauth_state")?.value;
  const storedProvider = cookieStore.get("oauth_provider")?.value;

  if (!storedState || state !== storedState) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  if (!storedProvider || !OAUTH_PROVIDERS[storedProvider]) {
    return NextResponse.json({ error: "Invalid provider session" }, { status: 400 });
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/auth/oauth/callback`;
    const tokens = await exchangeCode(storedProvider, code, redirectUri);

    await storeOAuthCredentials(
      session.userId,
      storedProvider,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresInSeconds,
      tokens.scopes
    );

    // Clear OAuth cookies
    cookieStore.delete("oauth_state");
    cookieStore.delete("oauth_provider");

    // Redirect to settings page (assuming it exists or will exist)
    return NextResponse.redirect(new URL("/settings", request.url));
  } catch (error: unknown) {
    console.error("OAuth callback error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
