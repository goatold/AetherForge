import { CollabWorkspace } from "@/components/collab-workspace";
import { readSession } from "@/lib/auth/session";
import { executeQuery, workspaceQueries } from "@/lib/db";

type Role = "owner" | "editor" | "viewer";

export default async function CollabPage() {
  const session = await readSession();
  if (!session) {
    return (
      <section className="panel">
        <h2>Collaboration and sharing</h2>
        <p>Sign in to manage workspace sharing.</p>
      </section>
    );
  }

  const workspaceResult = await executeQuery<{ id: string; owner_user_id: string }>(
    workspaceQueries.listForUser(session.userId)
  );
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return (
      <section className="panel">
        <h2>Collaboration and sharing</h2>
        <p>Create a workspace first to configure collaboration roles.</p>
      </section>
    );
  }

  const membersResult = await executeQuery<{
    workspace_id: string;
    user_id: string;
    email: string;
    display_name: string | null;
    role: Role;
    created_at: string;
  }>(workspaceQueries.listMembers(workspace.id));

  return (
    <CollabWorkspace
      initialMembers={membersResult.rows}
      canManage={workspace.owner_user_id === session.userId}
    />
  );
}
