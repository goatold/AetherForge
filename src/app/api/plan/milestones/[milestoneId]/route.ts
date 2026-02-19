import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import {
  executeQuery,
  planMilestoneQueries,
  progressQueries,
  workspaceQueries
} from "@/lib/db";

interface MilestonePatchBody {
  title?: string;
  dueDate?: string | null;
  completed?: boolean;
}

const parseDueDate = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
};

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

  const existingMilestoneResult = await executeQuery<{
    id: string;
    title: string;
    due_date: string | null;
    completed_at: string | null;
  }>(
    planMilestoneQueries.findByIdForUser(milestoneId, session.userId)
  );
  const existingMilestone = existingMilestoneResult.rows[0];
  if (!existingMilestone) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }

  let milestone: {
    id: string;
    learning_plan_id: string;
    title: string;
    due_date: string | null;
    completed_at: string | null;
  } | null = null;
  let eventType: string | null = null;

  if (typeof body.completed === "boolean") {
    const updatedResult = await executeQuery<{
      id: string;
      learning_plan_id: string;
      title: string;
      due_date: string | null;
      completed_at: string | null;
    }>(planMilestoneQueries.setCompleted(milestoneId, body.completed));
    milestone = updatedResult.rows[0] ?? null;
    eventType = body.completed ? "plan_milestone_completed" : "plan_milestone_reopened";
  } else {
    const nextTitle = body.title?.trim() ?? existingMilestone.title;
    if (!nextTitle) {
      return NextResponse.json({ error: "Milestone title cannot be empty" }, { status: 400 });
    }
    const dueDate =
      body.dueDate === undefined ? parseDueDate(existingMilestone.due_date) : parseDueDate(body.dueDate);
    const updatedResult = await executeQuery<{
      id: string;
      learning_plan_id: string;
      title: string;
      due_date: string | null;
      completed_at: string | null;
    }>(planMilestoneQueries.updateDetails(milestoneId, nextTitle, dueDate));
    milestone = updatedResult.rows[0] ?? null;
    eventType = "plan_milestone_updated";
  }

  if (milestone) {
    const workspaceResult = await executeQuery<{ id: string }>(
      workspaceQueries.listForUser(session.userId)
    );
    const workspace = workspaceResult.rows[0];
    if (workspace) {
      await executeQuery(
        progressQueries.insert(
          workspace.id,
          eventType ?? "plan_milestone_updated",
          JSON.stringify({
            milestoneId: milestone.id,
            title: milestone.title,
            dueDate: milestone.due_date
          })
        )
      );
    }
  }

  return NextResponse.json({
    milestone
  });
}

export async function DELETE(
  _request: Request,
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

  const existingMilestoneResult = await executeQuery<{ id: string; title: string }>(
    planMilestoneQueries.findByIdForUser(milestoneId, session.userId)
  );
  const existingMilestone = existingMilestoneResult.rows[0];
  if (!existingMilestone) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }

  await executeQuery(planMilestoneQueries.removeById(milestoneId));
  const workspaceResult = await executeQuery<{ id: string }>(
    workspaceQueries.listForUser(session.userId)
  );
  const workspace = workspaceResult.rows[0];
  if (workspace) {
    await executeQuery(
      progressQueries.insert(
        workspace.id,
        "plan_milestone_deleted",
        JSON.stringify({
          milestoneId,
          title: existingMilestone.title
        })
      )
    );
  }

  return NextResponse.json({ deleted: true });
}
