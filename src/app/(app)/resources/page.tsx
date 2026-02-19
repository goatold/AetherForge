import { ResourcesWorkspace } from "@/components/resources-workspace";
import { readSession } from "@/lib/auth/session";
import { executeQuery, resourceQueries, workspaceQueries } from "@/lib/db";

export default async function ResourcesPage() {
  const session = await readSession();
  if (!session) {
    return (
      <section className="panel">
        <h2>Notes and resources</h2>
        <p>Sign in to store your study links and references.</p>
      </section>
    );
  }

  const workspaceResult = await executeQuery<{ id: string }>(
    workspaceQueries.listForUser(session.userId)
  );
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return (
      <section className="panel">
        <h2>Notes and resources</h2>
        <p>Create a workspace first to unlock resource tracking.</p>
      </section>
    );
  }

  const resourcesResult = await executeQuery<{
    id: string;
    workspace_id: string;
    title: string;
    url: string | null;
    note_text: string | null;
    tags: string[];
    created_at: string;
  }>(resourceQueries.listByWorkspace(workspace.id));

  return <ResourcesWorkspace initialResources={resourcesResult.rows} />;
}
