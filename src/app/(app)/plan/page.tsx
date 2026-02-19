import { PlanWorkspace } from "@/components/plan-workspace";
import { readSession } from "@/lib/auth/session";
import {
  executeQuery,
  planMilestoneQueries,
  planQueries,
  workspaceQueries
} from "@/lib/db";

export default async function PlanPage() {
  const session = await readSession();
  if (!session) {
    return (
      <section className="panel">
        <h2>Learning plan and progress</h2>
        <p>Sign in to manage your plan milestones and completion progress.</p>
      </section>
    );
  }

  const workspaceResult = await executeQuery<{ id: string }>(
    workspaceQueries.listForUser(session.userId)
  );
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return (
      <section className="panel">
        <h2>Learning plan and progress</h2>
        <p>Create a workspace first to unlock planning features.</p>
      </section>
    );
  }

  const planResult = await executeQuery<{ id: string; title: string; updated_at: string }>(
    planQueries.getByWorkspace(workspace.id)
  );
  const plan = planResult.rows[0] ?? null;
  const milestonesResult =
    plan !== null
      ? await executeQuery<{
          id: string;
          learning_plan_id: string;
          title: string;
          due_date: string | null;
          completed_at: string | null;
        }>(planMilestoneQueries.listByPlan(plan.id))
      : { rows: [] as Array<{
          id: string;
          learning_plan_id: string;
          title: string;
          due_date: string | null;
          completed_at: string | null;
        }> };

  return <PlanWorkspace initialPlan={plan} initialMilestones={milestonesResult.rows} />;
}
