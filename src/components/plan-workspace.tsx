"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface PlanRecord {
  id: string;
  title: string;
  updated_at: string;
}

interface MilestoneRecord {
  id: string;
  learning_plan_id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
}

interface PlanWorkspaceProps {
  initialPlan: PlanRecord | null;
  initialMilestones: MilestoneRecord[];
  initialSummary: {
    submittedQuizAttempts: number;
    averageQuizScorePercent: number | null;
    totalFlashcards: number;
    dueFlashcardsNow: number;
  };
}

const toInputDate = (value: string | null) => {
  if (!value) {
    return "";
  }
  return value.slice(0, 10);
};

export function PlanWorkspace({
  initialPlan,
  initialMilestones,
  initialSummary
}: PlanWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [plan, setPlan] = useState<PlanRecord | null>(initialPlan);
  const [milestones, setMilestones] = useState<MilestoneRecord[]>(initialMilestones);
  const [planTitleDraft, setPlanTitleDraft] = useState(initialPlan?.title ?? "");
  const [milestoneTitleDraft, setMilestoneTitleDraft] = useState("");
  const [milestoneDueDateDraft, setMilestoneDueDateDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const completedCount = useMemo(
    () => milestones.filter((item) => item.completed_at !== null).length,
    [milestones]
  );
  const completionRatio = `${completedCount}/${milestones.length}`;

  const savePlanTitle = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: planTitleDraft })
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; plan?: PlanRecord | null }
        | null;
      if (!response.ok || !body?.plan) {
        setErrorMessage(body?.error ?? "Failed to save plan.");
        return;
      }
      setPlan(body.plan);
      setSuccessMessage("Plan title saved.");
      router.refresh();
    });
  };

  const addMilestone = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/plan/milestones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: milestoneTitleDraft,
          dueDate: milestoneDueDateDraft || null
        })
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; milestone?: MilestoneRecord | null }
        | null;
      if (!response.ok || !body?.milestone) {
        setErrorMessage(body?.error ?? "Failed to add milestone.");
        return;
      }
      setMilestones((previous) =>
        [...previous, body.milestone!].sort((a, b) =>
          (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31")
        )
      );
      setMilestoneTitleDraft("");
      setMilestoneDueDateDraft("");
      setSuccessMessage("Milestone added.");
      router.refresh();
    });
  };

  const toggleMilestone = (milestoneId: string, nextCompleted: boolean) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/plan/milestones/${milestoneId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ completed: nextCompleted })
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; milestone?: MilestoneRecord | null }
        | null;
      if (!response.ok || !body?.milestone) {
        setErrorMessage(body?.error ?? "Failed to update milestone.");
        return;
      }
      setMilestones((previous) =>
        previous.map((item) => (item.id === milestoneId ? body.milestone! : item))
      );
    });
  };

  return (
    <div className="space-y-4">
      <section className="panel">
        <h3>Progress snapshot</h3>
        <ul>
          <li>Submitted quiz attempts: {initialSummary.submittedQuizAttempts}</li>
          <li>
            Average quiz score:{" "}
            {initialSummary.averageQuizScorePercent === null
              ? "N/A"
              : `${initialSummary.averageQuizScorePercent}%`}
          </li>
          <li>
            Milestones complete: {completionRatio}
          </li>
          <li>
            Flashcards due now: {initialSummary.dueFlashcardsNow}/{initialSummary.totalFlashcards}
          </li>
        </ul>
      </section>

      <section className="panel">
        <h2>Learning plan and progress</h2>
        <p>Track milestones with deadlines and completion state for your current workspace.</p>
        <label htmlFor="plan-title">Plan title</label>
        <div className="row">
          <input
            id="plan-title"
            value={planTitleDraft}
            onChange={(event) => setPlanTitleDraft(event.target.value)}
            placeholder="My learning plan"
          />
          <button className="button" type="button" disabled={isPending} onClick={savePlanTitle}>
            {isPending ? "Saving..." : "Save plan"}
          </button>
        </div>
        {plan ? <p>Updated: {new Date(plan.updated_at).toLocaleString()}</p> : null}
      </section>

      <section className="panel">
        <h3>Add milestone</h3>
        <div className="row">
          <input
            value={milestoneTitleDraft}
            onChange={(event) => setMilestoneTitleDraft(event.target.value)}
            placeholder="Milestone title"
          />
          <input
            type="date"
            value={milestoneDueDateDraft}
            onChange={(event) => setMilestoneDueDateDraft(event.target.value)}
          />
          <button className="button" type="button" disabled={isPending} onClick={addMilestone}>
            {isPending ? "Adding..." : "Add"}
          </button>
        </div>
        <p>
          Progress: {completionRatio} completed
        </p>
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        {successMessage ? <p>{successMessage}</p> : null}
      </section>

      <section className="panel">
        <h3>Milestones</h3>
        {milestones.length === 0 ? (
          <p>No milestones yet.</p>
        ) : (
          <ul>
            {milestones.map((milestone) => {
              const completed = milestone.completed_at !== null;
              return (
                <li key={milestone.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={completed}
                      onChange={(event) => toggleMilestone(milestone.id, event.target.checked)}
                      disabled={isPending}
                    />{" "}
                    {milestone.title}
                  </label>{" "}
                  {milestone.due_date ? `(due ${toInputDate(milestone.due_date)})` : "(no due date)"}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
