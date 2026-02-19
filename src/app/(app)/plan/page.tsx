import { PlanWorkspace } from "@/components/plan-workspace";
import { readSession } from "@/lib/auth/session";
import {
  executeQuery,
  planMilestoneQueries,
  planQueries,
  progressQueries,
  workspaceQueries
} from "@/lib/db";

interface ProgressSummary {
  submittedQuizAttempts: number;
  averageQuizScorePercent: number | null;
  totalFlashcards: number;
  dueFlashcardsNow: number;
}

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

  const [quizStatsResult, flashcardStatsResult] = await Promise.all([
    executeQuery<{ submitted_count: string; avg_score_percent: string | null }>({
      text: `
        select
          count(*)::int::text as submitted_count,
          avg(a.score_percent)::numeric(5,2)::text as avg_score_percent
        from quiz_attempts a
        join quizzes q on q.id = a.quiz_id
        where q.workspace_id = $1 and a.user_id = $2 and a.status = 'submitted'
      `,
      values: [workspace.id, session.userId]
    }),
    executeQuery<{ total_count: string; due_now_count: string }>({
      text: `
        select
          count(*)::int::text as total_count,
          count(*) filter (where next_review_at <= now())::int::text as due_now_count
        from flashcards
        where workspace_id = $1
      `,
      values: [workspace.id]
    })
  ]);

  const quizStats = quizStatsResult.rows[0];
  const flashcardStats = flashcardStatsResult.rows[0];
  const summary: ProgressSummary = {
    submittedQuizAttempts: Number.parseInt(quizStats?.submitted_count ?? "0", 10),
    averageQuizScorePercent:
      quizStats?.avg_score_percent === null || quizStats?.avg_score_percent === undefined
        ? null
        : Number.parseFloat(quizStats.avg_score_percent),
    totalFlashcards: Number.parseInt(flashcardStats?.total_count ?? "0", 10),
    dueFlashcardsNow: Number.parseInt(flashcardStats?.due_now_count ?? "0", 10)
  };
  const progressEventsResult = await executeQuery<{
    id: string;
    event_type: string;
    payload_json: unknown;
    created_at: string;
  }>(progressQueries.listByWorkspace(workspace.id));
  const recentEvents = progressEventsResult.rows.slice(0, 12);

  return (
    <PlanWorkspace
      initialPlan={plan}
      initialMilestones={milestonesResult.rows}
      initialSummary={summary}
      initialRecentEvents={recentEvents}
    />
  );
}
