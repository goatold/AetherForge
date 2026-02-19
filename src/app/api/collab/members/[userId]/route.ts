import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import { executeQuery, progressQueries, workspaceQueries } from "@/lib/db";

type Role = "owner" | "editor" | "viewer";
const MUTABLE_ROLES: Role[] = ["editor", "viewer"];

interface MemberPatchBody {
  role?: Role;
}

const canManageMembers = (ownerUserId: string, userId: string) => ownerUserId === userId;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
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

  const { userId } = await context.params;
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if (userId === workspace.owner_user_id) {
    return NextResponse.json({ error: "Owner role cannot be modified" }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const body = rawBody as MemberPatchBody;
  if (!body.role || !MUTABLE_ROLES.includes(body.role)) {
    return NextResponse.json({ error: "Role must be editor or viewer" }, { status: 400 });
  }

  const memberResult = await executeQuery<{ user_id: string }>(
    workspaceQueries.findMember(workspace.id, userId)
  );
  if (!memberResult.rows[0]) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  await executeQuery(workspaceQueries.addMember(workspace.id, userId, body.role));
  await executeQuery(
    progressQueries.insert(
      workspace.id,
      "collab_member_role_updated",
      JSON.stringify({
        userId,
        role: body.role
      })
    )
  );

  const membersResult = await executeQuery<{
    workspace_id: string;
    user_id: string;
    email: string;
    display_name: string | null;
    role: Role;
    created_at: string;
  }>(workspaceQueries.listMembers(workspace.id));

  return NextResponse.json({ members: membersResult.rows });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ userId: string }> }
) {
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

  const { userId } = await context.params;
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if (userId === workspace.owner_user_id) {
    return NextResponse.json({ error: "Owner cannot be removed" }, { status: 400 });
  }

  const memberResult = await executeQuery<{ user_id: string }>(
    workspaceQueries.findMember(workspace.id, userId)
  );
  if (!memberResult.rows[0]) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  await executeQuery(workspaceQueries.removeMember(workspace.id, userId));
  await executeQuery(
    progressQueries.insert(
      workspace.id,
      "collab_member_removed",
      JSON.stringify({
        userId
      })
    )
  );

  const membersResult = await executeQuery<{
    workspace_id: string;
    user_id: string;
    email: string;
    display_name: string | null;
    role: Role;
    created_at: string;
  }>(workspaceQueries.listMembers(workspace.id));

  return NextResponse.json({ members: membersResult.rows });
}
