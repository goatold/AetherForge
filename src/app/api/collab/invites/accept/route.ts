import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import { collabAuditQueries, executeQuery, progressQueries, workspaceQueries } from "@/lib/db";

type Role = "owner" | "editor" | "viewer";

interface AcceptInviteBody {
  token?: string;
}

interface InviteRecord extends Record<string, unknown> {
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
  workspace_topic: string;
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const body = rawBody as AcceptInviteBody;
  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "Invite token is required" }, { status: 400 });
  }

  const inviteResult = await executeQuery<InviteRecord>(workspaceQueries.findInviteByToken(token));
  const invite = inviteResult.rows[0];
  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.revoked_at) {
    return NextResponse.json({ error: "Invite was revoked" }, { status: 410 });
  }
  if (invite.accepted_at) {
    return NextResponse.json({ error: "Invite was already accepted" }, { status: 409 });
  }
  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
  }

  const sessionEmail = session.email.trim().toLowerCase();
  if (invite.invited_email.toLowerCase() !== sessionEmail) {
    return NextResponse.json(
      { error: "Signed-in email does not match the invited recipient" },
      { status: 403 }
    );
  }

  const acceptedResult = await executeQuery<InviteRecord>(
    workspaceQueries.acceptInvite(invite.id, session.userId)
  );
  const acceptedInvite = acceptedResult.rows[0];
  if (!acceptedInvite) {
    return NextResponse.json({ error: "Invite is no longer active" }, { status: 409 });
  }

  const existingMemberResult = await executeQuery<{ user_id: string; role: Role }>(
    workspaceQueries.findMember(invite.workspace_id, session.userId)
  );
  const existingMember = existingMemberResult.rows[0];

  await executeQuery(workspaceQueries.addMember(invite.workspace_id, session.userId, invite.role));
  await executeQuery(
    progressQueries.insert(
      invite.workspace_id,
      "collab_invite_accepted",
      JSON.stringify({
        inviteId: invite.id,
        email: sessionEmail,
        role: invite.role
      })
    )
  );
  await executeQuery(
    collabAuditQueries.insert(
      invite.workspace_id,
      "invite_accepted",
      session.userId,
      session.userId,
      sessionEmail,
      existingMember?.role ?? null,
      invite.role,
      invite.id,
      JSON.stringify({
        invitedByUserId: invite.invited_by_user_id
      })
    )
  );

  return NextResponse.json({
    workspaceId: invite.workspace_id,
    workspaceTopic: invite.workspace_topic,
    role: invite.role
  });
}
