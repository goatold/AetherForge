import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import { executeQuery, progressQueries, userQueries, workspaceQueries } from "@/lib/db";

type Role = "owner" | "editor" | "viewer";
const MUTABLE_ROLES: Role[] = ["editor", "viewer"];

interface InviteBody {
  email?: string;
  role?: Role;
}

const canManageMembers = (ownerUserId: string, userId: string) => ownerUserId === userId;

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceResult = await executeQuery<{ id: string; owner_user_id: string }>(
    workspaceQueries.listForUser(session.userId)
  );
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return NextResponse.json({ members: [], canManage: false });
  }

  const membersResult = await executeQuery<{
    workspace_id: string;
    user_id: string;
    email: string;
    display_name: string | null;
    role: Role;
    created_at: string;
  }>(workspaceQueries.listMembers(workspace.id));

  return NextResponse.json({
    members: membersResult.rows,
    canManage: canManageMembers(workspace.owner_user_id, session.userId)
  });
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceResult = await executeQuery<{ id: string; owner_user_id: string }>(
    workspaceQueries.listForUser(session.userId)
  );
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }
  if (!canManageMembers(workspace.owner_user_id, session.userId)) {
    return NextResponse.json({ error: "Only workspace owner can manage members" }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const body = rawBody as InviteBody;
  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!body.role || !MUTABLE_ROLES.includes(body.role)) {
    return NextResponse.json({ error: "Role must be editor or viewer" }, { status: 400 });
  }

  const userResult = await executeQuery<{ id: string; email: string }>(userQueries.findByEmail(email));
  const user =
    userResult.rows[0] ??
    (
      await executeQuery<{ id: string; email: string }>(userQueries.insert(email, null))
    ).rows[0];
  if (!user) {
    return NextResponse.json({ error: "Failed to resolve invitee user" }, { status: 500 });
  }

  await executeQuery(workspaceQueries.addMember(workspace.id, user.id, body.role));
  await executeQuery(
    progressQueries.insert(
      workspace.id,
      "collab_member_upserted",
      JSON.stringify({
        email,
        role: body.role
      })
    )
  );

  const refreshedMembers = await executeQuery<{
    workspace_id: string;
    user_id: string;
    email: string;
    display_name: string | null;
    role: Role;
    created_at: string;
  }>(workspaceQueries.listMembers(workspace.id));

  return NextResponse.json({
    members: refreshedMembers.rows
  });
}
