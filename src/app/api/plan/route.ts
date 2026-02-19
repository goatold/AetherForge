import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import {
  executeQuery,
  planMilestoneQueries,
  planQueries,
  workspaceQueries
} from "@/lib/db";

interface PlanBody {
  title?: string;
}

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceResult = await executeQuery<{ id: string }>(workspaceQueries.listForUser(session.userId));
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return NextResponse.json({ plan: null, milestones: [] });
  }

  const planResult = await executeQuery<{ id: string; title: string; updated_at: string }>(
    planQueries.getByWorkspace(workspace.id)
  );
  const plan = planResult.rows[0] ?? null;
  if (!plan) {
    return NextResponse.json({ plan: null, milestones: [] });
  }

  const milestonesResult = await executeQuery<{
    id: string;
    learning_plan_id: string;
    title: string;
    due_date: string | null;
    completed_at: string | null;
  }>(planMilestoneQueries.listByPlan(plan.id));

  return NextResponse.json({
    plan,
    milestones: milestonesResult.rows
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
  const body = rawBody as PlanBody;
  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Plan title is required" }, { status: 400 });
  }

  const workspaceResult = await executeQuery<{ id: string }>(workspaceQueries.listForUser(session.userId));
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const updatedPlan = await executeQuery<{ id: string; workspace_id: string; title: string; updated_at: string }>(
    planQueries.upsert(workspace.id, title)
  );

  return NextResponse.json({
    plan: updatedPlan.rows[0] ?? null
  });
}
