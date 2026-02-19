import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import { collabAuditQueries, executeQuery, progressQueries, workspaceQueries } from "@/lib/db";

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

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ inviteId: string }> }
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

  const { inviteId } = await context.params;
  if (!inviteId) {
    return NextResponse.json({ error: "inviteId is required" }, { status: 400 });
  }

  const activeInviteResult = await executeQuery<PendingInviteRecord>(
    workspaceQueries.findActiveInviteById(workspace.id, inviteId)
  );
  const activeInvite = activeInviteResult.rows[0];
  if (!activeInvite) {
    return NextResponse.json({ error: "Active invite not found" }, { status: 404 });
  }

  const revokedResult = await executeQuery<PendingInviteRecord>(
    workspaceQueries.revokeInvite(inviteId, session.userId)
  );
  const revokedInvite = revokedResult.rows[0];
  if (!revokedInvite) {
    return NextResponse.json({ error: "Invite is no longer active" }, { status: 409 });
  }

  await executeQuery(
    progressQueries.insert(
      workspace.id,
      "collab_invite_revoked",
      JSON.stringify({
        inviteId: revokedInvite.id,
        email: revokedInvite.invited_email,
        role: revokedInvite.role
      })
    )
  );
  await executeQuery(
    collabAuditQueries.insert(
      workspace.id,
      "invite_revoked",
      session.userId,
      null,
      revokedInvite.invited_email,
      null,
      revokedInvite.role,
      revokedInvite.id,
      JSON.stringify({})
    )
  );

  const pendingInvitesResult = await executeQuery<PendingInviteRecord>(
    workspaceQueries.listPendingInvites(workspace.id)
  );

  return NextResponse.json({ pendingInvites: pendingInvitesResult.rows });
}
