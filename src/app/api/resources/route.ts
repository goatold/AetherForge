import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import { executeQuery, resourceQueries, workspaceQueries } from "@/lib/db";

interface ResourceBody {
  title?: string;
  url?: string | null;
  noteText?: string | null;
  tags?: string[] | string | null;
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

const normalizeNote = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeTags = (value: ResourceBody["tags"]): string[] => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item).trim().toLowerCase()).filter(Boolean))].slice(0, 12);
  }
  if (typeof value === "string") {
    return [
      ...new Set(
        value
          .split(",")
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
      )
    ].slice(0, 12);
  }
  return [];
};

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceResult = await executeQuery<{ id: string }>(workspaceQueries.listForUser(session.userId));
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return NextResponse.json({ resources: [] });
  }
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const tag = searchParams.get("tag")?.trim().toLowerCase() ?? "";

  const resourcesResult = await executeQuery<{
    id: string;
    workspace_id: string;
    title: string;
    url: string | null;
    note_text: string | null;
    tags: string[];
    created_at: string;
  }>(
    resourceQueries.listByWorkspaceFiltered(
      workspace.id,
      q.length > 0 ? q : null,
      tag.length > 0 ? tag : null
    )
  );

  return NextResponse.json({
    resources: resourcesResult.rows,
    filters: {
      q,
      tag
    }
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
    note_text: string | null;
    tags: string[];
    created_at: string;
  }>(
    resourceQueries.insert(
      workspace.id,
      title,
      normalizeUrl(body.url),
      normalizeNote(body.noteText),
      normalizeTags(body.tags)
    )
  );

  return NextResponse.json({
    resource: createdResult.rows[0] ?? null
  });
}
