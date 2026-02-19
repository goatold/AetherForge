import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import { executeQuery, progressQueries, resourceQueries, workspaceQueries } from "@/lib/db";

interface ResourcePatchBody {
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
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeNote = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeTags = (value: ResourcePatchBody["tags"]): string[] => {
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ resourceId: string }> }
) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { resourceId } = await context.params;
  if (!resourceId) {
    return NextResponse.json({ error: "resourceId is required" }, { status: 400 });
  }

  const existingResult = await executeQuery<{
    id: string;
    title: string;
    url: string | null;
    note_text: string | null;
    tags: string[];
  }>(resourceQueries.findByIdForUser(resourceId, session.userId));
  const existing = existingResult.rows[0];
  if (!existing) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const body = rawBody as ResourcePatchBody;
  const title = body.title?.trim() ?? existing.title;
  if (!title) {
    return NextResponse.json({ error: "Resource title cannot be empty" }, { status: 400 });
  }
  const url = body.url === undefined ? normalizeUrl(existing.url) : normalizeUrl(body.url);
  const noteText =
    body.noteText === undefined ? normalizeNote(existing.note_text) : normalizeNote(body.noteText);
  const tags = body.tags === undefined ? existing.tags : normalizeTags(body.tags);

  const updatedResult = await executeQuery<{
    id: string;
    workspace_id: string;
    title: string;
    url: string | null;
    note_text: string | null;
    tags: string[];
    created_at: string;
  }>(resourceQueries.updateById(resourceId, title, url, noteText, tags));
  const resource = updatedResult.rows[0] ?? null;
  if (!resource) {
    return NextResponse.json({ error: "Failed to update resource" }, { status: 500 });
  }

  const workspaceResult = await executeQuery<{ id: string }>(
    workspaceQueries.listForUser(session.userId)
  );
  const workspace = workspaceResult.rows[0];
  if (workspace) {
    await executeQuery(
      progressQueries.insert(
        workspace.id,
        "resource_updated",
        JSON.stringify({
          resourceId: resource.id,
          title: resource.title,
          tags: resource.tags
        })
      )
    );
  }

  return NextResponse.json({ resource });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ resourceId: string }> }
) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { resourceId } = await context.params;
  if (!resourceId) {
    return NextResponse.json({ error: "resourceId is required" }, { status: 400 });
  }

  const existingResult = await executeQuery<{ id: string; title: string }>(
    resourceQueries.findByIdForUser(resourceId, session.userId)
  );
  const existing = existingResult.rows[0];
  if (!existing) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  await executeQuery(resourceQueries.removeById(resourceId));
  const workspaceResult = await executeQuery<{ id: string }>(
    workspaceQueries.listForUser(session.userId)
  );
  const workspace = workspaceResult.rows[0];
  if (workspace) {
    await executeQuery(
      progressQueries.insert(
        workspace.id,
        "resource_deleted",
        JSON.stringify({
          resourceId,
          title: existing.title
        })
      )
    );
  }

  return NextResponse.json({ deleted: true });
}
