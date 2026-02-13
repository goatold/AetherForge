import Link from "next/link";
import { notFound } from "next/navigation";

import { ConceptGraph } from "@/components/concept-graph";
import { readSession } from "@/lib/auth/session";
import { conceptArtifactQueries, conceptQueries, executeQuery } from "@/lib/db";

interface ArtifactDetailPageProps {
  params: Promise<{ artifactId: string }>;
}

export default async function ArtifactDetailPage({ params }: ArtifactDetailPageProps) {
  const session = await readSession();
  if (!session) {
    notFound();
  }

  const { artifactId } = await params;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(artifactId)) {
    notFound();
  }

  const artifactResult = await executeQuery<{
    id: string;
    topic: string;
    difficulty: string;
    artifact_version: number;
    provider: string;
    model: string;
    created_at: string;
  }>(conceptArtifactQueries.findByIdForUser(artifactId, session.userId));
  const artifact = artifactResult.rows[0];

  if (!artifact) {
    notFound();
  }

  const conceptsResult = await executeQuery<{
    id: string;
    title: string;
    summary: string;
    created_at: string;
  }>(conceptQueries.listByArtifactForUser(artifact.id, session.userId));
  const concepts = conceptsResult.rows as Array<{
    id: string;
    title: string;
    summary: string;
  }>;

  return (
    <div className="space-y-4">
      <section className="panel">
        <p>
          <Link href="/learn">Back to explorer</Link>
        </p>
        <h2>Artifact v{artifact.artifact_version}</h2>
        <p>
          Topic: {artifact.topic} ({artifact.difficulty})
        </p>
        <p>
          Source: {artifact.provider}/{artifact.model}
        </p>
      </section>

      <ConceptGraph
        artifactLabel={`v${artifact.artifact_version} - ${artifact.topic}`}
        nodes={concepts.map((concept) => ({ id: concept.id, title: concept.title }))}
      />

      <section className="panel">
        <h3>Generated concepts</h3>
        {concepts.length === 0 ? (
          <p>No concepts linked to this artifact.</p>
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
    </div>
  );
}
