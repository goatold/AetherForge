import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { readSession } from "@/lib/auth/session";
import { collabAuditQueries, executeQuery, progressQueries, workspaceQueries } from "@/lib/db";

type Role = "owner" | "editor" | "viewer";
const MUTABLE_ROLES: Role[] = ["editor", "viewer"];

interface InviteBody {
  email?: string;
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
const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const buildInviteToken = () => randomBytes(24).toString("base64url");

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
    return NextResponse.json({ members: [], pendingInvites: [], canManage: false });
  }

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

  return NextResponse.json({
    members: membersResult.rows,
    pendingInvites: invitesResult.rows,
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
  const inviteRole = body.role as "editor" | "viewer";

  const membersResult = await executeQuery<{
    workspace_id: string;
    user_id: string;
    email: string;
    display_name: string | null;
    role: Role;
    created_at: string;
  }>(workspaceQueries.listMembers(workspace.id));
  const existingMember = membersResult.rows.find(
    (member) => member.email.toLowerCase() === email
  );

  if (existingMember?.role === "owner") {
    return NextResponse.json({ error: "Owner role cannot be modified" }, { status: 400 });
  }

  let invited: PendingInviteRecord | null = null;
  if (existingMember) {
    await executeQuery(workspaceQueries.addMember(workspace.id, existingMember.user_id, inviteRole));
    await executeQuery(
      progressQueries.insert(
        workspace.id,
        "collab_member_role_updated",
        JSON.stringify({
          userId: existingMember.user_id,
          email,
          role: inviteRole
        })
      )
    );
    await executeQuery(
      collabAuditQueries.insert(
        workspace.id,
        "member_role_updated",
        session.userId,
        existingMember.user_id,
        email,
        existingMember.role,
        inviteRole,
        null,
        JSON.stringify({ source: "invite_upsert_email" })
      )
    );
  } else {
    const expiresAtIso = new Date(Date.now() + INVITE_TTL_MS).toISOString();
    const token = buildInviteToken();
    const activeInviteResult = await executeQuery<PendingInviteRecord>(
      workspaceQueries.findActiveInviteByEmail(workspace.id, email)
    );
    const activeInvite = activeInviteResult.rows[0];
    if (activeInvite) {
      const refreshed = await executeQuery<PendingInviteRecord>(
        workspaceQueries.refreshInvite(activeInvite.id, inviteRole, token, expiresAtIso)
      );
      invited = refreshed.rows[0] ?? null;
    } else {
      const created = await executeQuery<PendingInviteRecord>(
        workspaceQueries.createInvite(
          workspace.id,
          email,
          inviteRole,
          token,
          session.userId,
          expiresAtIso
        )
      );
      invited = created.rows[0] ?? null;
    }
    await executeQuery(
      progressQueries.insert(
        workspace.id,
        "collab_invite_created",
        JSON.stringify({
          email,
          role: inviteRole,
          inviteId: invited?.id ?? null,
          expiresAt: invited?.expires_at ?? expiresAtIso
        })
      )
    );
    await executeQuery(
      collabAuditQueries.insert(
        workspace.id,
        "invite_created",
        session.userId,
        null,
        email,
        null,
        inviteRole,
        invited?.id ?? null,
        JSON.stringify({
          expiresAt: invited?.expires_at ?? expiresAtIso
        })
      )
    );
  }

  const refreshedMembers = await executeQuery<{
    workspace_id: string;
    user_id: string;
    email: string;
    display_name: string | null;
    role: Role;
    created_at: string;
  }>(workspaceQueries.listMembers(workspace.id));
  const refreshedInvites = await executeQuery<PendingInviteRecord>(
    workspaceQueries.listPendingInvites(workspace.id)
  );

  return NextResponse.json({
    members: refreshedMembers.rows,
    pendingInvites: refreshedInvites.rows,
    invitedLinkPath: invited ? `/invite/${invited.token}` : null
  });
}
