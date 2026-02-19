import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import {
  executeQuery,
  planMilestoneQueries,
  progressQueries,
  workspaceQueries
} from "@/lib/db";

interface MilestonePatchBody {
  completed?: boolean;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ milestoneId: string }> }
) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { milestoneId } = await context.params;
  if (!milestoneId) {
    return NextResponse.json({ error: "milestoneId is required" }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const body = rawBody as MilestonePatchBody;
  if (typeof body.completed !== "boolean") {
    return NextResponse.json({ error: "completed boolean is required" }, { status: 400 });
  }

  const milestoneResult = await executeQuery<{ id: string }>(
    planMilestoneQueries.findByIdForUser(milestoneId, session.userId)
  );
  if (!milestoneResult.rows[0]) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }

  const updatedResult = await executeQuery<{
    id: string;
    learning_plan_id: string;
    title: string;
    due_date: string | null;
    completed_at: string | null;
  }>(planMilestoneQueries.setCompleted(milestoneId, body.completed));
  const milestone = updatedResult.rows[0] ?? null;
  if (milestone) {
    const workspaceResult = await executeQuery<{ id: string }>(
      workspaceQueries.listForUser(session.userId)
    );
    const workspace = workspaceResult.rows[0];
    if (workspace) {
      await executeQuery(
        progressQueries.insert(
          workspace.id,
          body.completed ? "plan_milestone_completed" : "plan_milestone_reopened",
          JSON.stringify({
            milestoneId: milestone.id,
            title: milestone.title
          })
        )
      );
    }
  }

  return NextResponse.json({
    milestone
  });
}
