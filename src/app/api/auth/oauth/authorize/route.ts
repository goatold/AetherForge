import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { getAuthorizationUrl } from "@/lib/ai/oauth-providers";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

export async function GET(request: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const provider = searchParams.get("provider");

  if (!provider) {
    return NextResponse.json({ error: "Missing provider" }, { status: 400 });
  }

  try {
    const state = randomBytes(32).toString("hex");
    const redirectUri = `${request.nextUrl.origin}/api/auth/oauth/callback`;
    
    // Store state in cookie for CSRF protection
    const cookieStore = await cookies();
    cookieStore.set("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600 // 10 minutes
    });
    
    // Store provider in cookie to know which provider to exchange code for
    cookieStore.set("oauth_provider", provider, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600
    });

    const url = getAuthorizationUrl(provider, state, redirectUri);
    return NextResponse.redirect(url);
  } catch (error: unknown) {
    console.error("OAuth authorize error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
