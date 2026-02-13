import { NextResponse } from "next/server";

import { executeQuery, userQueries, workspaceQueries } from "@/lib/db";
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

  const displayName = email.split("@")[0] || "Learner";
  const userResult = await executeQuery<{
    id: string;
    email: string;
  }>(userQueries.insert(email, displayName));
  const user = userResult.rows[0];

  if (!user) {
    return NextResponse.json({ error: "Unable to create session user" }, { status: 500 });
  }

  const existingWorkspaces = await executeQuery<{
    id: string;
  }>(workspaceQueries.listForUser(user.id));

  if (existingWorkspaces.rows.length === 0) {
    const workspaceResult = await executeQuery<{
      id: string;
    }>(workspaceQueries.create(user.id, "Operating Systems", "beginner"));
    const workspace = workspaceResult.rows[0];

    if (workspace) {
      await executeQuery(workspaceQueries.addMember(workspace.id, user.id, "owner"));
    }
  }

  const nextPath = sanitizeNextPath(formData.get("next"));
  const response = NextResponse.redirect(new URL(nextPath, request.url), 303);
  response.cookies.set(
    SESSION_COOKIE_NAME,
    createSessionToken(user.id, user.email),
    getSessionCookieOptions()
  );
  return response;
}
