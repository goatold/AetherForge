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

interface TimelineEvent {
  id: string;
  event_type: string;
  payload_json: unknown;
  created_at: string;
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
  initialRecentEvents: Array<{
    id: string;
    event_type: string;
    payload_json: unknown;
    created_at: string;
  }>;
  initialHasMoreEvents: boolean;
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
  initialSummary,
  initialRecentEvents,
  initialHasMoreEvents
}: PlanWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [plan, setPlan] = useState<PlanRecord | null>(initialPlan);
  const [milestones, setMilestones] = useState<MilestoneRecord[]>(initialMilestones);
  const [planTitleDraft, setPlanTitleDraft] = useState(initialPlan?.title ?? "");
  const [milestoneTitleDraft, setMilestoneTitleDraft] = useState("");
  const [milestoneDueDateDraft, setMilestoneDueDateDraft] = useState("");
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [editMilestoneTitleDraft, setEditMilestoneTitleDraft] = useState("");
  const [editMilestoneDueDateDraft, setEditMilestoneDueDateDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<TimelineEvent[]>(initialRecentEvents);
  const [timelineCategory, setTimelineCategory] = useState<"all" | "milestone" | "resource">("all");
  const [hasMoreEvents, setHasMoreEvents] = useState(initialHasMoreEvents);

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
      router.refresh();
    });
  };

  const beginMilestoneEdit = (milestone: MilestoneRecord) => {
    setEditingMilestoneId(milestone.id);
    setEditMilestoneTitleDraft(milestone.title);
    setEditMilestoneDueDateDraft(toInputDate(milestone.due_date));
  };

  const cancelMilestoneEdit = () => {
    setEditingMilestoneId(null);
    setEditMilestoneTitleDraft("");
    setEditMilestoneDueDateDraft("");
  };

  const saveMilestoneEdit = () => {
    if (!editingMilestoneId) {
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/plan/milestones/${editingMilestoneId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: editMilestoneTitleDraft,
          dueDate: editMilestoneDueDateDraft || null
        })
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; milestone?: MilestoneRecord | null }
        | null;
      if (!response.ok || !body?.milestone) {
        setErrorMessage(body?.error ?? "Failed to save milestone.");
        return;
      }
      setMilestones((previous) =>
        previous
          .map((item) => (item.id === editingMilestoneId ? body.milestone! : item))
          .sort((a, b) => (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31"))
      );
      setEditingMilestoneId(null);
      setEditMilestoneTitleDraft("");
      setEditMilestoneDueDateDraft("");
      setSuccessMessage("Milestone updated.");
      router.refresh();
    });
  };

  const deleteMilestone = (milestoneId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/plan/milestones/${milestoneId}`, {
        method: "DELETE"
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: string; deleted?: boolean }
        | null;
      if (!response.ok || body?.deleted !== true) {
        setErrorMessage(body?.error ?? "Failed to delete milestone.");
        return;
      }
      setMilestones((previous) => previous.filter((item) => item.id !== milestoneId));
      if (editingMilestoneId === milestoneId) {
        cancelMilestoneEdit();
      }
      setSuccessMessage("Milestone deleted.");
      router.refresh();
    });
  };

  const toTimelineMessage = (event: TimelineEvent): string => {
    const payload =
      event.payload_json && typeof event.payload_json === "object"
        ? (event.payload_json as Record<string, unknown>)
        : null;
    const title =
      payload && typeof payload.title === "string" && payload.title.trim().length > 0
        ? payload.title
        : null;
    const byType: Record<string, string> = {
      plan_milestone_created: `Milestone created${title ? `: ${title}` : ""}`,
      plan_milestone_completed: `Milestone completed${title ? `: ${title}` : ""}`,
      plan_milestone_reopened: `Milestone reopened${title ? `: ${title}` : ""}`,
      plan_milestone_updated: `Milestone updated${title ? `: ${title}` : ""}`,
      plan_milestone_deleted: `Milestone deleted${title ? `: ${title}` : ""}`,
      resource_added: `Resource added${title ? `: ${title}` : ""}`,
      resource_updated: `Resource updated${title ? `: ${title}` : ""}`,
      resource_deleted: `Resource deleted${title ? `: ${title}` : ""}`
    };
    return byType[event.event_type] ?? event.event_type;
  };

  const refreshTimeline = (
    category: "all" | "milestone" | "resource",
    mode: "replace" | "append"
  ) => {
    startTransition(async () => {
      const offset = mode === "append" ? recentEvents.length : 0;
      const response = await fetch(
        `/api/progress/events?category=${category}&limit=12&offset=${offset}`
      );
      const body = (await response.json().catch(() => null)) as
        | {
            error?: string;
            events?: TimelineEvent[];
            hasMore?: boolean;
          }
        | null;
      if (!response.ok || !Array.isArray(body?.events)) {
        setErrorMessage(body?.error ?? "Failed to load timeline.");
        return;
      }
      if (mode === "append") {
        setRecentEvents((previous) => [...previous, ...body.events!]);
      } else {
        setRecentEvents(body.events);
      }
      setHasMoreEvents(body?.hasMore ?? false);
    });
  };

  const handleTimelineCategoryChange = (next: "all" | "milestone" | "resource") => {
    setTimelineCategory(next);
    refreshTimeline(next, "replace");
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
        <h3>Recent activity timeline</h3>
        <div className="row">
          <button
            className="button subtle-button"
            type="button"
            disabled={isPending}
            onClick={() => handleTimelineCategoryChange("all")}
          >
            All
          </button>
          <button
            className="button subtle-button"
            type="button"
            disabled={isPending}
            onClick={() => handleTimelineCategoryChange("milestone")}
          >
            Milestones
          </button>
          <button
            className="button subtle-button"
            type="button"
            disabled={isPending}
            onClick={() => handleTimelineCategoryChange("resource")}
          >
            Resources
          </button>
          <span style={{ alignSelf: "center" }}>Current: {timelineCategory}</span>
        </div>
        {recentEvents.length === 0 ? (
          <p>No progress events yet.</p>
        ) : (
          <ul>
            {recentEvents.map((event) => (
              <li key={event.id}>
                {toTimelineMessage(event)} at {new Date(event.created_at).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
        {hasMoreEvents ? (
          <button
            className="button subtle-button"
            type="button"
            disabled={isPending}
            onClick={() => refreshTimeline(timelineCategory, "append")}
          >
            {isPending ? "Loading..." : "Load more"}
          </button>
        ) : null}
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
              const isEditing = editingMilestoneId === milestone.id;
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
                  {" - "}
                  <button
                    className="button subtle-button"
                    type="button"
                    disabled={isPending}
                    onClick={() => beginMilestoneEdit(milestone)}
                  >
                    Edit
                  </button>
                  {" / "}
                  <button
                    className="button subtle-button"
                    type="button"
                    disabled={isPending}
                    onClick={() => deleteMilestone(milestone.id)}
                  >
                    Delete
                  </button>
                  {isEditing ? (
                    <div className="row" style={{ marginTop: "0.5rem" }}>
                      <input
                        value={editMilestoneTitleDraft}
                        onChange={(event) => setEditMilestoneTitleDraft(event.target.value)}
                        placeholder="Milestone title"
                      />
                      <input
                        type="date"
                        value={editMilestoneDueDateDraft}
                        onChange={(event) => setEditMilestoneDueDateDraft(event.target.value)}
                      />
                      <button
                        className="button subtle-button"
                        type="button"
                        disabled={isPending}
                        onClick={saveMilestoneEdit}
                      >
                        Save
                      </button>
                      <button
                        className="button subtle-button"
                        type="button"
                        disabled={isPending}
                        onClick={cancelMilestoneEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
