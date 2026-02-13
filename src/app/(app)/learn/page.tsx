import Link from "next/link";

import { ConceptGenerationForm } from "@/components/concept-generation-form";
import { readSession } from "@/lib/auth/session";
import { executeQuery, conceptArtifactQueries, conceptQueries, workspaceQueries } from "@/lib/db";

export default async function LearnPage() {
  const session = await readSession();
  if (!session) {
    return (
      <section className="panel">
        <h2>Concept explorer</h2>
        <p>Sign in to generate and browse concept artifacts.</p>
      </section>
    );
  }

  const workspaceResult = await executeQuery<{
    id: string;
    topic: string;
    difficulty: "beginner" | "intermediate" | "advanced";
  }>(workspaceQueries.listForUser(session.userId));
  const workspace = workspaceResult.rows[0];

  if (!workspace) {
    return (
      <section className="panel">
        <h2>Concept explorer</h2>
        <p>Create a workspace first to generate concepts.</p>
      </section>
    );
  }

  const [conceptsResult, artifactsResult] = await Promise.all([
    executeQuery<{
      id: string;
      title: string;
      summary: string;
      created_at: string;
    }>(conceptQueries.listByWorkspace(workspace.id)),
    executeQuery<{
      id: string;
      artifact_version: number;
      provider: string;
      model: string;
      created_at: string;
    }>(conceptArtifactQueries.listByWorkspace(workspace.id))
  ]);
  const artifacts = artifactsResult.rows as Array<{
    id: string;
    artifact_version: number;
    provider: string;
    model: string;
    created_at: string;
  }>;
  const concepts = conceptsResult.rows as Array<{
    id: string;
    title: string;
    summary: string;
    created_at: string;
  }>;

  return (
    <section className="space-y-4">
      <ConceptGenerationForm
        defaultTopic={workspace.topic}
        defaultDifficulty={workspace.difficulty}
      />

      <section className="panel">
        <h3>Artifacts</h3>
        {artifacts.length === 0 ? (
          <p>No generated artifacts yet.</p>
        ) : (
          <ul>
            {artifacts.map((artifact) => (
              <li key={artifact.id}>
                <Link href={`/learn/artifacts/${artifact.id}`}>
                  v{artifact.artifact_version}
                </Link>{" "}
                - {artifact.provider}/{artifact.model} at{" "}
                {new Date(artifact.created_at).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h3>Concept explorer</h3>
        {concepts.length === 0 ? (
          <p>No concepts yet. Generate one to begin.</p>
        ) : (
          <ul>
            {concepts.map((concept) => (
              <li key={concept.id}>
                <Link href={`/learn/${concept.id}`}>{concept.title}</Link>
                <p>{concept.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
