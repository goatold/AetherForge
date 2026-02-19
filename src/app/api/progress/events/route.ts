import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import { executeQuery, progressQueries, workspaceQueries } from "@/lib/db";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

const parseLimit = (value: string | null): number => {
  if (!value) {
    return DEFAULT_LIMIT;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
};

const parseOffset = (value: string | null): number => {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
};

type EventCategory = "all" | "milestone" | "resource";

const parseCategory = (value: string | null): EventCategory => {
  if (value === "milestone" || value === "resource") {
    return value;
  }
  return "all";
};

const toEventPrefix = (category: EventCategory): string | null => {
  if (category === "milestone") {
    return "plan_milestone_";
  }
  if (category === "resource") {
    return "resource_";
  }
  return null;
};

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceResult = await executeQuery<{ id: string }>(workspaceQueries.listForUser(session.userId));
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return NextResponse.json({
      events: [],
      category: "all" as EventCategory,
      limit: DEFAULT_LIMIT,
      offset: 0,
      hasMore: false,
      totalCount: 0
    });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams.get("limit"));
  const offset = parseOffset(searchParams.get("offset"));
  const category = parseCategory(searchParams.get("category"));
  const eventPrefix = toEventPrefix(category);

  const [eventsResult, countResult] = await Promise.all([
    executeQuery<{
      id: string;
      workspace_id: string;
      event_type: string;
      payload_json: unknown;
      created_at: string;
    }>(progressQueries.listByWorkspacePaged(workspace.id, limit, offset, eventPrefix)),
    executeQuery<{ total_count: string }>(progressQueries.countByWorkspaceFiltered(workspace.id, eventPrefix))
  ]);

  const totalCount = Number.parseInt(countResult.rows[0]?.total_count ?? "0", 10);
  const nextOffset = offset + eventsResult.rows.length;

  return NextResponse.json({
    events: eventsResult.rows,
    category,
    limit,
    offset,
    hasMore: nextOffset < totalCount,
    totalCount
  });
}
