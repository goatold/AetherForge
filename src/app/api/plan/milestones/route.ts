import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import {
  executeQuery,
  planMilestoneQueries,
  planQueries,
  workspaceQueries
} from "@/lib/db";

interface MilestoneBody {
  title?: string;
  dueDate?: string | null;
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
  const body = rawBody as MilestoneBody;
  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Milestone title is required" }, { status: 400 });
  }

  const workspaceResult = await executeQuery<{ id: string }>(workspaceQueries.listForUser(session.userId));
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  let planResult = await executeQuery<{ id: string; title: string; updated_at: string }>(
    planQueries.getByWorkspace(workspace.id)
  );
  let plan = planResult.rows[0];
  if (!plan) {
    const createdPlan = await executeQuery<{ id: string; title: string; updated_at: string }>(
      planQueries.upsert(workspace.id, "My learning plan")
    );
    plan = createdPlan.rows[0];
    planResult = createdPlan;
  }
  if (!plan) {
    return NextResponse.json({ error: "Failed to initialize learning plan" }, { status: 500 });
  }

  const milestoneResult = await executeQuery<{
    id: string;
    learning_plan_id: string;
    title: string;
    due_date: string | null;
    completed_at: string | null;
  }>(planMilestoneQueries.insert(plan.id, title, parseDueDate(body.dueDate)));

  return NextResponse.json({
    milestone: milestoneResult.rows[0] ?? null
  });
}
