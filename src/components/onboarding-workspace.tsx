"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { DIFFICULTY_LEVELS, type DifficultyLevel, type WorkspaceSummary } from "@/lib/contracts/domain";

const STARTER_GOALS = [
  "Understand the core terminology",
  "Practice with mixed-difficulty quizzes",
  "Build a durable review habit"
] as const;

export function OnboardingWorkspace() {
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [topicDraft, setTopicDraft] = useState("");
  const [difficultyDraft, setDifficultyDraft] = useState<DifficultyLevel>("beginner");
  const [goalsDraft, setGoalsDraft] = useState<string[]>([]);
  const [newGoalDraft, setNewGoalDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const hasGoalLimit = goalsDraft.length >= 8;
  const canSave = topicDraft.trim().length >= 2 && goalsDraft.length > 0;
  const hasChanges = useMemo(() => {
    if (!workspace) {
      return false;
    }
    const goalLabels = workspace.goals.map((goal) => goal.label);
    return (
      workspace.topic !== topicDraft ||
      workspace.difficulty !== difficultyDraft ||
      goalLabels.join("|") !== goalsDraft.join("|")
    );
  }, [difficultyDraft, goalsDraft, topicDraft, workspace]);

  useEffect(() => {
    let cancelled = false;
    const loadWorkspace = async () => {
      const response = await fetch("/api/workspace");
      const body = (await response.json().catch(() => null)) as
        | {
            error?: string;
            workspace?: WorkspaceSummary;
          }
        | null;
      if (cancelled) {
        return;
      }
      if (!response.ok || !body?.workspace) {
        setErrorMessage(body?.error ?? "Unable to load workspace.");
        setIsLoading(false);
        return;
      }
      const initialGoals =
        body.workspace.goals.length > 0
          ? body.workspace.goals.map((goal) => goal.label)
          : [...STARTER_GOALS];
      setWorkspace(body.workspace);
      setTopicDraft(body.workspace.topic);
      setDifficultyDraft(body.workspace.difficulty);
      setGoalsDraft(initialGoals);
      setIsLoading(false);
    };

    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, []);

  const addGoal = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const label = newGoalDraft.trim();
    if (label.length < 3 || label.length > 120) {
      setErrorMessage("Goal text must be between 3 and 120 characters.");
      return;
    }
    if (hasGoalLimit) {
      setErrorMessage("Goal limit reached (max 8).");
      return;
    }
    if (goalsDraft.some((goal) => goal.toLowerCase() === label.toLowerCase())) {
      setErrorMessage("That goal is already listed.");
      return;
    }
    setGoalsDraft((previous) => [...previous, label]);
    setNewGoalDraft("");
  };

  const removeGoal = (index: number) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setGoalsDraft((previous) => previous.filter((_, goalIndex) => goalIndex !== index));
  };

  const saveWorkspace = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/workspace", {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          topic: topicDraft,
          difficulty: difficultyDraft,
          goals: goalsDraft
        })
      });
      const body = (await response.json().catch(() => null)) as
        | {
            error?: string;
            workspace?: WorkspaceSummary;
          }
        | null;
      if (!response.ok || !body?.workspace) {
        setErrorMessage(body?.error ?? "Unable to save onboarding settings.");
        return;
      }
      setWorkspace(body.workspace);
      setTopicDraft(body.workspace.topic);
      setDifficultyDraft(body.workspace.difficulty);
      setGoalsDraft(body.workspace.goals.map((goal) => goal.label));
      setSuccessMessage("Onboarding settings saved.");
    });
  };

  if (isLoading) {
    return (
      <section className="panel">
        <h2>Topic onboarding</h2>
        <p>Loading workspace setup...</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="panel">
        <h2>Topic onboarding</h2>
        <p>Define your active topic, target difficulty, and learning objectives.</p>
        <label htmlFor="onboarding-topic">Topic</label>
        <div className="row">
          <input
            id="onboarding-topic"
            value={topicDraft}
            onChange={(event) => setTopicDraft(event.target.value)}
            placeholder="Operating Systems"
          />
        </div>
        <label htmlFor="onboarding-difficulty">Difficulty</label>
        <div className="row">
          <select
            id="onboarding-difficulty"
            value={difficultyDraft}
            onChange={(event) => setDifficultyDraft(event.target.value as DifficultyLevel)}
          >
            {DIFFICULTY_LEVELS.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {difficulty}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="panel">
        <h3>Learning goals</h3>
        <p>Add up to 8 goals. These goals shape later concept and quiz sessions.</p>
        <div className="row">
          <input
            value={newGoalDraft}
            onChange={(event) => setNewGoalDraft(event.target.value)}
            placeholder="Understand process scheduling trade-offs"
          />
          <button className="button subtle-button" type="button" onClick={addGoal} disabled={isPending || hasGoalLimit}>
            Add goal
          </button>
        </div>
        {goalsDraft.length === 0 ? (
          <p>No goals yet. Add at least one objective.</p>
        ) : (
          <ul>
            {goalsDraft.map((goal, index) => (
              <li key={`${goal}-${index}`}>
                {goal}{" "}
                <button
                  className="button subtle-button"
                  type="button"
                  disabled={isPending}
                  onClick={() => removeGoal(index)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <p>{goalsDraft.length}/8 goals</p>
      </section>

      <section className="panel">
        <div className="row">
          <button
            className="button"
            type="button"
            onClick={saveWorkspace}
            disabled={isPending || !canSave || !hasChanges}
          >
            {isPending ? "Saving..." : "Save onboarding"}
          </button>
          {workspace ? <span>Workspace created {new Date(workspace.createdAtIso).toLocaleDateString()}</span> : null}
        </div>
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        {successMessage ? <p>{successMessage}</p> : null}
      </section>
    </div>
  );
}
