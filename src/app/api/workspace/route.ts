import { NextResponse } from "next/server";

import {
  DIFFICULTY_LEVELS,
  type WorkspaceSummary,
  type WorkspaceSummaryResponse
} from "@/lib/contracts/domain";
import { readSession } from "@/lib/auth/session";
import { executeQuery, workspaceQueries } from "@/lib/db";

const isDifficulty = (value: string): value is (typeof DIFFICULTY_LEVELS)[number] =>
  DIFFICULTY_LEVELS.includes(value as (typeof DIFFICULTY_LEVELS)[number]);

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceResult = await executeQuery<{
    id: string;
    topic: string;
    difficulty: string;
    created_at: string;
  }>(workspaceQueries.listForUser(session.userId));

  const row = workspaceResult.rows[0];
  if (!row) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const difficulty = isDifficulty(row.difficulty) ? row.difficulty : "beginner";
  const workspace: WorkspaceSummary = {
    id: row.id,
    topic: row.topic,
    difficulty,
    goals: [],
    createdAtIso: row.created_at
  };

  const body: WorkspaceSummaryResponse = {
    workspace
  };

  return NextResponse.json(body);
}
