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

interface CollabWorkspaceProps {
  initialMembers: MemberRecord[];
  canManage: boolean;
}

export function CollabWorkspace({ initialMembers, canManage }: CollabWorkspaceProps) {
  const [isPending, startTransition] = useTransition();
  const [members, setMembers] = useState<MemberRecord[]>(initialMembers);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("viewer");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inviteMember = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/collab/members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; members?: MemberRecord[] }
        | null;
      if (!response.ok || !Array.isArray(body?.members)) {
        setErrorMessage(body?.error ?? "Failed to invite member.");
        return;
      }
      setMembers(body.members);
      setInviteEmail("");
    });
  };

  const updateMemberRole = (userId: string, role: "editor" | "viewer") => {
    setErrorMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/collab/members/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role })
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; members?: MemberRecord[] }
        | null;
      if (!response.ok || !Array.isArray(body?.members)) {
        setErrorMessage(body?.error ?? "Failed to update member role.");
        return;
      }
      setMembers(body.members);
    });
  };

  const removeMember = (userId: string) => {
    setErrorMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/collab/members/${userId}`, {
        method: "DELETE"
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; members?: MemberRecord[] }
        | null;
      if (!response.ok || !Array.isArray(body?.members)) {
        setErrorMessage(body?.error ?? "Failed to remove member.");
        return;
      }
      setMembers(body.members);
    });
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
    </div>
  );
}
