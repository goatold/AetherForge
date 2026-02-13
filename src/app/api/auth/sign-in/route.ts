import { NextResponse } from "next/server";

import {
  createSessionToken,
  getSessionCookieOptions
} from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const sanitizeNextPath = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string") {
    return "/onboarding";
  }
  return value.startsWith("/") ? value : "/onboarding";
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const emailValue = formData.get("email");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";

  if (!email) {
    const redirectUrl = new URL("/sign-in?error=missing-email", request.url);
    return NextResponse.redirect(redirectUrl, 303);
  }

  const nextPath = sanitizeNextPath(formData.get("next"));
  const response = NextResponse.redirect(new URL(nextPath, request.url), 303);
  response.cookies.set(
    SESSION_COOKIE_NAME,
    createSessionToken(email),
    getSessionCookieOptions()
  );
  return response;
}
