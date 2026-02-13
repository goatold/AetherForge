import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/sign-in", request.url), 303);
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
