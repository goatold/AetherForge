import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import { executeQuery, resourceQueries, workspaceQueries } from "@/lib/db";

interface ResourceBody {
  title?: string;
  url?: string | null;
}

const normalizeUrl = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
};

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceResult = await executeQuery<{ id: string }>(workspaceQueries.listForUser(session.userId));
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return NextResponse.json({ resources: [] });
  }

  const resourcesResult = await executeQuery<{
    id: string;
    workspace_id: string;
    title: string;
    url: string | null;
    created_at: string;
  }>(resourceQueries.listByWorkspace(workspace.id));

  return NextResponse.json({
    resources: resourcesResult.rows
  });
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
  const body = rawBody as ResourceBody;
  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Resource title is required" }, { status: 400 });
  }

  const workspaceResult = await executeQuery<{ id: string }>(workspaceQueries.listForUser(session.userId));
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const createdResult = await executeQuery<{
    id: string;
    workspace_id: string;
    title: string;
    url: string | null;
    created_at: string;
  }>(resourceQueries.insert(workspace.id, title, normalizeUrl(body.url)));

  return NextResponse.json({
    resource: createdResult.rows[0] ?? null
  });
}
