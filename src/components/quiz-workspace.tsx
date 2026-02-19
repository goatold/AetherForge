"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type QuestionType = "mcq" | "true_false" | "short_answer";

interface QuizOption {
  id: string;
  key: string;
  text: string;
  position: number;
}

interface QuizQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  explanation: string;
  position: number;
  options: QuizOption[];
}

interface QuizSummary {
  id: string;
  title: string;
  createdAt: string;
  questionCount: number;
}

interface AttemptHistoryItem {
  id: string;
  scorePercent: number | null;
  submittedAt: string | null;
}

interface QuizWorkspaceProps {
  latestQuiz: QuizSummary | null;
  latestQuizQuestions: QuizQuestion[];
  initialRecentAttempts: AttemptHistoryItem[];
}

interface ActiveAttempt {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  questions: QuizQuestion[];
}

interface SubmissionFeedback {
  scorePercent: number;
  correctCount: number;
  totalQuestions: number;
  weakAreaPrompts: string[];
  nextActions: string[];
}

interface AttemptResponseDraft {
  selectedOptionId?: string;
  answerText?: string;
}

const trendLabel = (attempts: AttemptHistoryItem[]) => {
  const scored = attempts
    .map((attempt) => attempt.scorePercent)
    .filter((value): value is number => typeof value === "number");
  if (scored.length < 2) {
    return "Need at least two submitted attempts for trend.";
  }
  const latest = scored[0];
  const previous = scored[1];
  const delta = Number((latest - previous).toFixed(1));
  if (delta > 0) {
    return `Up ${delta}% vs previous attempt`;
  }
  if (delta < 0) {
    return `Down ${Math.abs(delta)}% vs previous attempt`;
  }
  return "Flat trend vs previous attempt";
};

export function QuizWorkspace({
  latestQuiz,
  latestQuizQuestions,
  initialRecentAttempts
}: QuizWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<ActiveAttempt | null>(null);
  const [draftResponses, setDraftResponses] = useState<Record<string, AttemptResponseDraft>>({});
  const [feedback, setFeedback] = useState<SubmissionFeedback | null>(null);
  const [timeframeDays, setTimeframeDays] = useState<7 | 14 | 30 | 90>(30);
  const [recentAttempts, setRecentAttempts] =
    useState<AttemptHistoryItem[]>(initialRecentAttempts);

  const scoreAverage = useMemo(() => {
    const scored = recentAttempts
      .map((attempt) => attempt.scorePercent)
      .filter((value): value is number => typeof value === "number");
    if (scored.length === 0) {
      return null;
    }
    const avg = scored.reduce((sum, value) => sum + value, 0) / scored.length;
    return Number(avg.toFixed(1));
  }, [recentAttempts]);

  const handleGenerateQuiz = () => {
    setErrorMessage(null);
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch("/api/quiz/generate", { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setErrorMessage(body?.error ?? "Failed to generate quiz.");
        return;
      }
      router.refresh();
    });
  };

  const handleStartAttempt = (quizId: string) => {
    setErrorMessage(null);
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch("/api/quiz/attempts/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quizId })
      });
      const body = (await response.json().catch(() => null)) as
        | {
            error?: string;
            attempt?: { id: string };
            quiz?: { id: string; title: string; questions: QuizQuestion[] };
          }
        | null;

      if (!response.ok || !body?.attempt || !body.quiz) {
        setErrorMessage(body?.error ?? "Failed to start attempt.");
        return;
      }

      setDraftResponses({});
      setActiveAttempt({
        attemptId: body.attempt.id,
        quizId: body.quiz.id,
        quizTitle: body.quiz.title,
        questions: body.quiz.questions
      });
    });
  };

  const handleSubmitAttempt = () => {
    if (!activeAttempt) {
      return;
    }

    setErrorMessage(null);
    startTransition(async () => {
      const responses = activeAttempt.questions.map((question) => ({
        questionId: question.id,
        selectedOptionId: draftResponses[question.id]?.selectedOptionId ?? null,
        answerText: draftResponses[question.id]?.answerText ?? null
      }));

      const response = await fetch(`/api/quiz/attempts/${activeAttempt.attemptId}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ responses })
      });
      const body = (await response.json().catch(() => null)) as
        | {
            error?: string;
            feedback?: SubmissionFeedback;
          }
        | null;

      if (!response.ok || !body?.feedback) {
        setErrorMessage(body?.error ?? "Failed to submit attempt.");
        return;
      }

      setFeedback(body.feedback);
      setActiveAttempt(null);
      setDraftResponses({});
      router.refresh();
    });
  };

  const handleTimeframeChange = (nextValue: 7 | 14 | 30 | 90) => {
    setErrorMessage(null);
    setTimeframeDays(nextValue);

    startTransition(async () => {
      const response = await fetch(`/api/quiz/attempts?timeframeDays=${nextValue}`);
      const body = (await response.json().catch(() => null)) as
        | {
            error?: string;
            attempts?: Array<{
              id: string;
              score_percent: string | null;
              submitted_at: string | null;
            }>;
          }
        | null;
      if (!response.ok || !Array.isArray(body?.attempts)) {
        setErrorMessage(body?.error ?? "Failed to load timeframe data.");
        return;
      }
      setRecentAttempts(
        body.attempts.map((attempt) => ({
          id: attempt.id,
          scorePercent:
            attempt.score_percent === null ? null : Number.parseFloat(attempt.score_percent),
          submittedAt: attempt.submitted_at
        }))
      );
    });
  };

  return (
    <div className="space-y-4">
      <section className="panel">
        <h2>Quiz practice</h2>
        <p>Generate mixed question sets from your latest concept graph and submit scored attempts.</p>
        <div className="row">
          <button className="button" type="button" disabled={isPending} onClick={handleGenerateQuiz}>
            {isPending ? "Generating..." : "Generate new quiz"}
          </button>
          {latestQuiz ? (
            <button
              className="button subtle-button"
              type="button"
              disabled={isPending}
              onClick={() => handleStartAttempt(latestQuiz.id)}
            >
              {isPending ? "Starting..." : "Start latest quiz"}
            </button>
          ) : null}
        </div>
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      </section>

      <section className="panel">
        <h3>Latest quiz</h3>
        {!latestQuiz ? (
          <p>No quizzes yet. Generate one from your concept workspace.</p>
        ) : (
          <>
            <p>
              <strong>{latestQuiz.title}</strong> ({latestQuiz.questionCount} questions) created{" "}
              {new Date(latestQuiz.createdAt).toLocaleString()}.
            </p>
            {latestQuizQuestions.length > 0 ? (
              <ul>
                {latestQuizQuestions.map((question) => (
                  <li key={question.id}>
                    Q{question.position} ({question.type}): {question.prompt}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Question set unavailable for this quiz.</p>
            )}
          </>
        )}
      </section>

      {activeAttempt ? (
        <section className="panel">
          <h3>Attempt in progress: {activeAttempt.quizTitle}</h3>
          <div className="quiz-attempt-form">
            {activeAttempt.questions.map((question) => (
              <fieldset className="quiz-question" key={question.id}>
                <legend>
                  Q{question.position}: {question.prompt}
                </legend>
                {question.type === "short_answer" ? (
                  <textarea
                    rows={3}
                    value={draftResponses[question.id]?.answerText ?? ""}
                    onChange={(event) =>
                      setDraftResponses((prev) => ({
                        ...prev,
                        [question.id]: {
                          ...prev[question.id],
                          answerText: event.target.value
                        }
                      }))
                    }
                  />
                ) : (
                  <div className="quiz-option-list">
                    {question.options.map((option) => (
                      <label key={option.id}>
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          checked={draftResponses[question.id]?.selectedOptionId === option.id}
                          onChange={() =>
                            setDraftResponses((prev) => ({
                              ...prev,
                              [question.id]: {
                                ...prev[question.id],
                                selectedOptionId: option.id
                              }
                            }))
                          }
                        />{" "}
                        {option.text}
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            ))}
          </div>
          <button className="button" disabled={isPending} type="button" onClick={handleSubmitAttempt}>
            {isPending ? "Submitting..." : "Submit attempt"}
          </button>
        </section>
      ) : null}

      {feedback ? (
        <section className="panel">
          <h3>Feedback</h3>
          <p>
            Score: {feedback.scorePercent}% ({feedback.correctCount}/{feedback.totalQuestions})
          </p>
          {feedback.weakAreaPrompts.length > 0 ? (
            <>
              <h4>Weak areas</h4>
              <ul>
                {feedback.weakAreaPrompts.map((prompt) => (
                  <li key={prompt}>{prompt}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>No major weak areas detected in this attempt.</p>
          )}
          <h4>Next actions</h4>
          <ul>
            {feedback.nextActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel">
        <h3>Attempt trends</h3>
        <label htmlFor="attempt-timeframe">Timeframe</label>{" "}
        <select
          id="attempt-timeframe"
          value={timeframeDays}
          onChange={(event) => handleTimeframeChange(Number(event.target.value) as 7 | 14 | 30 | 90)}
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <p>{trendLabel(recentAttempts)}</p>
        <p>Average score (recent): {scoreAverage !== null ? `${scoreAverage}%` : "N/A"}</p>
        {recentAttempts.length === 0 ? (
          <p>No submitted attempts yet.</p>
        ) : (
          <ul>
            {recentAttempts.map((attempt) => (
              <li key={attempt.id}>
                {attempt.scorePercent ?? "N/A"}% at{" "}
                {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : "not submitted"}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
