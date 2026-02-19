"use client";

import { useState, useTransition } from "react";

type Role = "owner" | "editor" | "viewer";

interface MemberRecord {
  workspace_id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  role: Role;
  created_at: string;
}

interface PendingInviteRecord {
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

interface CollabWorkspaceProps {
  initialMembers: MemberRecord[];
  initialPendingInvites: PendingInviteRecord[];
  canManage: boolean;
}

export function CollabWorkspace({
  initialMembers,
  initialPendingInvites,
  canManage
}: CollabWorkspaceProps) {
  const [isPending, startTransition] = useTransition();
  const [members, setMembers] = useState<MemberRecord[]>(initialMembers);
  const [pendingInvites, setPendingInvites] = useState<PendingInviteRecord[]>(initialPendingInvites);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("viewer");
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inviteMember = () => {
    setInfoMessage(null);
    setErrorMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/collab/members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      const body = (await response.json().catch(() => null)) as
        | {
            error?: string;
            members?: MemberRecord[];
            pendingInvites?: PendingInviteRecord[];
            invitedLinkPath?: string | null;
          }
        | null;
      if (!response.ok || !Array.isArray(body?.members) || !Array.isArray(body?.pendingInvites)) {
        setErrorMessage(body?.error ?? "Failed to invite member.");
        return;
      }
      setMembers(body.members);
      setPendingInvites(body.pendingInvites);
      if (body.invitedLinkPath) {
        setInfoMessage(`Invite link ready: ${body.invitedLinkPath}`);
      } else {
        setInfoMessage("Member role updated.");
      }
      setInviteEmail("");
    });
  };

  const updateMemberRole = (userId: string, role: "editor" | "viewer") => {
    setInfoMessage(null);
    setErrorMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/collab/members/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role })
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; members?: MemberRecord[]; pendingInvites?: PendingInviteRecord[] }
        | null;
      if (!response.ok || !Array.isArray(body?.members)) {
        setErrorMessage(body?.error ?? "Failed to update member role.");
        return;
      }
      setMembers(body.members);
      if (Array.isArray(body.pendingInvites)) {
        setPendingInvites(body.pendingInvites);
      }
      setInfoMessage("Member role updated.");
    });
  };

  const removeMember = (userId: string) => {
    setInfoMessage(null);
    setErrorMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/collab/members/${userId}`, {
        method: "DELETE"
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; members?: MemberRecord[]; pendingInvites?: PendingInviteRecord[] }
        | null;
      if (!response.ok || !Array.isArray(body?.members)) {
        setErrorMessage(body?.error ?? "Failed to remove member.");
        return;
      }
      setMembers(body.members);
      if (Array.isArray(body.pendingInvites)) {
        setPendingInvites(body.pendingInvites);
      }
      setInfoMessage("Member revoked.");
    });
  };

  const revokeInvite = (inviteId: string) => {
    setInfoMessage(null);
    setErrorMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/collab/invites/${inviteId}`, {
        method: "DELETE"
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; pendingInvites?: PendingInviteRecord[] }
        | null;
      if (!response.ok || !Array.isArray(body?.pendingInvites)) {
        setErrorMessage(body?.error ?? "Failed to revoke invite.");
        return;
      }
      setPendingInvites(body.pendingInvites);
      setInfoMessage("Invite revoked.");
    });
  };

  const copyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setInfoMessage("Invite link copied.");
      setErrorMessage(null);
    } catch {
      setErrorMessage("Unable to copy invite link.");
    }
  };

  return (
    <div className="space-y-4">
      <section className="panel">
        <h2>Collaboration and sharing</h2>
        <p>Manage workspace access with owner/editor/viewer roles.</p>
        {!canManage ? (
          <p>Your role does not allow member management in this workspace.</p>
        ) : (
          <div className="row">
            <input
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="teammate@example.com"
            />
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as "editor" | "viewer")}
            >
              <option value="viewer">viewer</option>
              <option value="editor">editor</option>
            </select>
            <button className="button" type="button" disabled={isPending} onClick={inviteMember}>
              {isPending ? "Inviting..." : "Invite / update"}
            </button>
          </div>
        )}
        {infoMessage ? <p>{infoMessage}</p> : null}
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      </section>

      <section className="panel">
        <h3>Members</h3>
        {members.length === 0 ? (
          <p>No members found.</p>
        ) : (
          <ul>
            {members.map((member) => (
              <li key={member.user_id}>
                {member.email} ({member.role}) joined{" "}
                {new Date(member.created_at).toLocaleDateString()}
                {canManage && member.role !== "owner" ? (
                  <>
                    {" - "}
                    <button
                      className="button subtle-button"
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        updateMemberRole(
                          member.user_id,
                          member.role === "editor" ? "viewer" : "editor"
                        )
                      }
                    >
                      Make {member.role === "editor" ? "viewer" : "editor"}
                    </button>
                    {" / "}
                    <button
                      className="button subtle-button"
                      type="button"
                      disabled={isPending}
                      onClick={() => removeMember(member.user_id)}
                    >
                      Revoke
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h3>Pending invites</h3>
        {pendingInvites.length === 0 ? (
          <p>No active invites.</p>
        ) : (
          <ul>
            {pendingInvites.map((invite) => (
              <li key={invite.id}>
                {invite.invited_email} ({invite.role}) expires{" "}
                {new Date(invite.expires_at).toLocaleDateString()}
                {" - "}
                <button
                  className="button subtle-button"
                  type="button"
                  disabled={isPending}
                  onClick={() => copyInviteLink(invite.token)}
                >
                  Copy invite link
                </button>
                {canManage ? (
                  <>
                    {" / "}
                    <button
                      className="button subtle-button"
                      type="button"
                      disabled={isPending}
                      onClick={() => revokeInvite(invite.id)}
                    >
                      Revoke invite
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
