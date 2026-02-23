import { NextResponse } from "next/server";

import {
  DIFFICULTY_LEVELS,
  type WorkspaceSummary,
  type WorkspaceSummaryResponse
} from "@/lib/contracts/domain";
import { readSession } from "@/lib/auth/session";
import { executeQuery, workspaceGoalQueries, workspaceQueries } from "@/lib/db";

const isDifficulty = (value: string): value is (typeof DIFFICULTY_LEVELS)[number] =>
  DIFFICULTY_LEVELS.includes(value as (typeof DIFFICULTY_LEVELS)[number]);

const normalizeGoalLabels = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const label = item.trim();
    if (label.length === 0 || label.length > 120) {
      continue;
    }
    const dedupeKey = label.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    normalized.push(label);
    if (normalized.length >= 8) {
      break;
    }
  }
  return normalized;
};

async function loadWorkspaceSummary(userId: string): Promise<WorkspaceSummary | null> {
  const workspaceResult = await executeQuery<{
    id: string;
    topic: string;
    difficulty: string;
    created_at: string;
  }>(workspaceQueries.listForUser(userId));

  const row = workspaceResult.rows[0];
  if (!row) {
    return null;
  }

  const goalsResult = await executeQuery<{
    id: string;
    label: string;
  }>(workspaceGoalQueries.listByWorkspace(row.id));
  const difficulty = isDifficulty(row.difficulty) ? row.difficulty : "beginner";
  return {
    id: row.id,
    topic: row.topic,
    difficulty,
    goals: goalsResult.rows.map((goal) => ({
      id: goal.id,
      label: goal.label
    })),
    createdAtIso: row.created_at
  };
}

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await loadWorkspaceSummary(session.userId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const body: WorkspaceSummaryResponse = {
    workspace
  };

  return NextResponse.json(body);
}

export async function PATCH(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        topic?: unknown;
        difficulty?: unknown;
        goals?: unknown;
      }
    | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const topic = typeof payload.topic === "string" ? payload.topic.trim() : "";
  if (topic.length < 2 || topic.length > 120) {
    return NextResponse.json(
      { error: "Topic must be between 2 and 120 characters." },
      { status: 400 }
    );
  }

  if (typeof payload.difficulty !== "string" || !isDifficulty(payload.difficulty)) {
    return NextResponse.json({ error: "Difficulty is invalid." }, { status: 400 });
  }

  const goalLabels = normalizeGoalLabels(payload.goals);
  if (goalLabels.length === 0) {
    return NextResponse.json({ error: "Add at least one learning goal." }, { status: 400 });
  }

  const workspaceSummary = await loadWorkspaceSummary(session.userId);
  if (!workspaceSummary) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  await executeQuery(
    workspaceQueries.updateBasics(workspaceSummary.id, topic, payload.difficulty)
  );
  await executeQuery(workspaceGoalQueries.replaceByWorkspace(workspaceSummary.id, goalLabels));

  const workspace = await loadWorkspaceSummary(session.userId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  return NextResponse.json({ workspace } satisfies WorkspaceSummaryResponse);
}
