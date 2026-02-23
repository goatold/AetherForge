import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const PROTECTED_ROUTES = [
  "/onboarding",
  "/learn",
  "/quiz",
  "/flashcards",
  "/plan",
  "/resources",
  "/export",
  "/collab"
] as const;

const isProtectedRoute = (pathname: string) =>
  PROTECTED_ROUTES.some(
    (protectedRoute) =>
      pathname === protectedRoute || pathname.startsWith(`${protectedRoute}/`)
  );

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!hasSession && isProtectedRoute(pathname)) {
    const signInUrl = new URL("/sign-in", request.url);
    const next = `${pathname}${search}`;
    signInUrl.searchParams.set("next", next);
    return NextResponse.redirect(signInUrl);
  }

  if (hasSession && pathname === "/sign-in") {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/onboarding/:path*",
    "/learn/:path*",
    "/quiz/:path*",
    "/flashcards/:path*",
    "/plan/:path*",
    "/resources/:path*",
    "/export/:path*",
    "/collab/:path*",
    "/sign-in"
  ]
};
