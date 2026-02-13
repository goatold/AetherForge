import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import { conceptArtifactQueries, executeQuery, workspaceQueries } from "@/lib/db";

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceResult = await executeQuery<{ id: string }>(
    workspaceQueries.listForUser(session.userId)
  );
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return NextResponse.json({ artifacts: [] });
  }

  const artifactsResult = await executeQuery<{
    id: string;
    topic: string;
    difficulty: string;
    artifact_version: number;
    provider: string;
    model: string;
    created_at: string;
  }>(conceptArtifactQueries.listByWorkspace(workspace.id));

  return NextResponse.json({ artifacts: artifactsResult.rows });
}
