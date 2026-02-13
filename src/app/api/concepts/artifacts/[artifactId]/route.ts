import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import {
  conceptArtifactQueries,
  conceptQueries,
  executeQuery
} from "@/lib/db";

interface ArtifactRouteProps {
  params: Promise<{ artifactId: string }>;
}

export async function GET(_request: Request, { params }: ArtifactRouteProps) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { artifactId } = await params;

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
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  const conceptsResult = await executeQuery<{
    id: string;
    title: string;
    summary: string;
    created_at: string;
  }>(conceptQueries.listByArtifactForUser(artifact.id, session.userId));

  return NextResponse.json({
    artifact,
    concepts: conceptsResult.rows
  });
}
