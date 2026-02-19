import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import { collabAuditQueries, executeQuery, progressQueries, workspaceQueries } from "@/lib/db";

type Role = "owner" | "editor" | "viewer";
const MUTABLE_ROLES: Role[] = ["editor", "viewer"];

interface MemberPatchBody {
  role?: Role;
}

interface PendingInviteRecord extends Record<string, unknown> {
  id: string;
  workspace_id: string;
  invited_email: string;
  role: "editor" | "viewer";
  token: string;
  invited_by_user_id: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
  revoked_at: string | null;
  revoked_by_user_id: string | null;
  created_at: string;
  updated_at: string;
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

  const memberResult = await executeQuery<{ user_id: string; role: Role; email: string }>(
    workspaceQueries.findMemberWithEmail(workspace.id, userId)
  );
  const currentMember = memberResult.rows[0];
  if (!currentMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  await executeQuery(workspaceQueries.addMember(workspace.id, userId, body.role));
  await executeQuery(
    progressQueries.insert(
      workspace.id,
      "collab_member_role_updated",
      JSON.stringify({
        userId,
        email: currentMember.email,
        role: body.role
      })
    )
  );
  await executeQuery(
    collabAuditQueries.insert(
      workspace.id,
      "member_role_updated",
      session.userId,
      userId,
      currentMember.email,
      currentMember.role,
      body.role,
      null,
      JSON.stringify({ source: "member_patch" })
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
  const invitesResult = await executeQuery<PendingInviteRecord>(
    workspaceQueries.listPendingInvites(workspace.id)
  );

  return NextResponse.json({ members: membersResult.rows, pendingInvites: invitesResult.rows });
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

  const memberResult = await executeQuery<{ user_id: string; role: Role; email: string }>(
    workspaceQueries.findMemberWithEmail(workspace.id, userId)
  );
  const currentMember = memberResult.rows[0];
  if (!currentMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  await executeQuery(workspaceQueries.removeMember(workspace.id, userId));
  const revokedInviteRows = await executeQuery<{ id: string }>(
    workspaceQueries.revokePendingInvitesByEmail(workspace.id, currentMember.email, session.userId)
  );
  await executeQuery(
    progressQueries.insert(
      workspace.id,
      "collab_member_removed",
      JSON.stringify({
        userId,
        email: currentMember.email,
        role: currentMember.role,
        revokedInviteCount: revokedInviteRows.rowCount
      })
    )
  );
  await executeQuery(
    collabAuditQueries.insert(
      workspace.id,
      "member_revoked",
      session.userId,
      userId,
      currentMember.email,
      currentMember.role,
      null,
      null,
      JSON.stringify({
        revokedInviteCount: revokedInviteRows.rowCount
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
  const invitesResult = await executeQuery<PendingInviteRecord>(
    workspaceQueries.listPendingInvites(workspace.id)
  );

  return NextResponse.json({ members: membersResult.rows, pendingInvites: invitesResult.rows });
}
