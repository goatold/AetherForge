"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
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
  weakAreas: Array<{
    conceptId: string | null;
    conceptTitle: string;
    prompt: string;
  }>;
  nextActions: string[];
}

interface AttemptResponseDraft {
  selectedOptionId?: string;
  answerText?: string;
}

interface AttemptReviewItem {
  questionId: string;
  position: number;
  questionType: QuestionType;
  prompt: string;
  explanation: string;
  correctAnswerText: string;
  submittedAnswerText: string;
  isCorrect: boolean;
  concept: { id: string; title: string } | null;
}

interface AttemptComparison {
  currentAttempt: {
    id: string;
    scorePercent: number | null;
    submittedAt: string;
  };
  previousAttempt: {
    id: string;
    scorePercent: number | null;
    submittedAt: string;
  };
  scoreDeltaPercent: number | null;
  byQuestionType: Array<{
    type: QuestionType;
    currentAccuracyPercent: number | null;
    previousAccuracyPercent: number | null;
    deltaPercent: number | null;
    currentTotal: number;
    previousTotal: number;
  }>;
  weakConceptDeltas: Array<{
    conceptId: string;
    conceptTitle: string;
    currentIncorrectCount: number;
    previousIncorrectCount: number;
    deltaIncorrectCount: number;
  }>;
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
  const [selectedReviewAttemptId, setSelectedReviewAttemptId] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<AttemptReviewItem[] | null>(null);
  const [comparison, setComparison] = useState<AttemptComparison | null>(null);

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
    setSelectedReview(null);
    setSelectedReviewAttemptId(null);

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

  const handleGenerateTargetedRetry = () => {
    setErrorMessage(null);
    const conceptIds = [
      ...new Set(
        (feedback?.weakAreas ?? [])
          .map((weakArea) => weakArea.conceptId)
          .filter((conceptId): conceptId is string => typeof conceptId === "string")
      )
    ];
    if (conceptIds.length === 0) {
      setErrorMessage("No weak concepts available for targeted retry yet.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conceptIds })
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setErrorMessage(body?.error ?? "Failed to generate targeted retry quiz.");
        return;
      }
      router.refresh();
    });
  };

  const handleStartAttempt = (quizId: string) => {
    setErrorMessage(null);
    setFeedback(null);
    setSelectedReview(null);
    setSelectedReviewAttemptId(null);

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
            attempt?: { id: string };
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
      if (body.attempt?.id) {
        setSelectedReviewAttemptId(body.attempt.id);
      }
      router.refresh();
    });
  };

  const loadAttemptReview = (attemptId: string) => {
    setErrorMessage(null);
    setSelectedReviewAttemptId(attemptId);

    startTransition(async () => {
      const response = await fetch(`/api/quiz/attempts/${attemptId}`);
      const body = (await response.json().catch(() => null)) as
        | {
            error?: string;
            review?: AttemptReviewItem[];
          }
        | null;
      if (!response.ok || !Array.isArray(body?.review)) {
        setErrorMessage(body?.error ?? "Failed to load attempt review.");
        return;
      }
      setSelectedReview(body.review);
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

      const comparisonResponse = await fetch(
        `/api/quiz/attempts/compare?timeframeDays=${nextValue}`
      );
      const comparisonBody = (await comparisonResponse.json().catch(() => null)) as
        | {
            error?: string;
            comparison?: AttemptComparison | null;
          }
        | null;
      if (!comparisonResponse.ok) {
        setErrorMessage(comparisonBody?.error ?? "Failed to load comparison analytics.");
        return;
      }
      setComparison(comparisonBody?.comparison ?? null);
    });
  };

  const loadComparison = (timeframe: 7 | 14 | 30 | 90) => {
    startTransition(async () => {
      const response = await fetch(`/api/quiz/attempts/compare?timeframeDays=${timeframe}`);
      const body = (await response.json().catch(() => null)) as
        | { error?: string; comparison?: AttemptComparison | null }
        | null;
      if (!response.ok) {
        setErrorMessage(body?.error ?? "Failed to load comparison analytics.");
        return;
      }
      setComparison(body?.comparison ?? null);
    });
  };

  useEffect(() => {
    let isCancelled = false;
    const run = async () => {
      const response = await fetch("/api/quiz/attempts/compare?timeframeDays=30");
      const body = (await response.json().catch(() => null)) as
        | { error?: string; comparison?: AttemptComparison | null }
        | null;
      if (isCancelled) {
        return;
      }
      if (!response.ok) {
        setErrorMessage(body?.error ?? "Failed to load comparison analytics.");
        return;
      }
      setComparison(body?.comparison ?? null);
    };

    void run();
    return () => {
      isCancelled = true;
    };
  }, []);

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
          {selectedReviewAttemptId ? (
            <p>
              <Link href={`/quiz/attempts/${selectedReviewAttemptId}`}>Open full attempt review</Link>
            </p>
          ) : null}
          {feedback.weakAreas.length > 0 ? (
            <>
              <h4>Weak areas</h4>
              <ul>
                {feedback.weakAreas.map((weakArea) => (
                  <li key={`${weakArea.conceptId ?? "none"}-${weakArea.prompt}`}>
                    {weakArea.conceptId ? (
                      <Link href={`/learn/${weakArea.conceptId}`}>{weakArea.conceptTitle}</Link>
                    ) : (
                      weakArea.conceptTitle
                    )}
                    : {weakArea.prompt}
                  </li>
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
          <button
            className="button"
            type="button"
            disabled={isPending}
            onClick={handleGenerateTargetedRetry}
          >
            {isPending ? "Generating retry..." : "Generate targeted retry quiz"}
          </button>
        </section>
      ) : null}

      {selectedReview ? (
        <section className="panel">
          <h3>Attempt review</h3>
          {selectedReviewAttemptId ? <p>Attempt: {selectedReviewAttemptId}</p> : null}
          <ul>
            {selectedReview.map((item) => (
              <li key={item.questionId}>
                <p>
                  <strong>
                    Q{item.position} ({item.questionType})
                  </strong>{" "}
                  - {item.isCorrect ? "Correct" : "Incorrect"}
                </p>
                <p>{item.prompt}</p>
                <p>
                  <strong>Submitted:</strong> {item.submittedAnswerText || "(no answer)"}
                </p>
                <p>
                  <strong>Expected:</strong> {item.correctAnswerText}
                </p>
                <p>
                  <strong>Why:</strong> {item.explanation}
                </p>
                {item.concept ? (
                  <p>
                    <Link href={`/learn/${item.concept.id}`}>Review concept: {item.concept.title}</Link>
                  </p>
                ) : null}
              </li>
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
        <button
          className="button subtle-button"
          type="button"
          disabled={isPending}
          onClick={() => loadComparison(timeframeDays)}
        >
          {isPending ? "Refreshing..." : "Refresh comparison"}
        </button>
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
                {" - "}
                <button
                  className="button subtle-button"
                  type="button"
                  disabled={isPending}
                  onClick={() => loadAttemptReview(attempt.id)}
                >
                  {selectedReviewAttemptId === attempt.id && isPending
                    ? "Loading review..."
                    : "Review"}
                </button>
                {" / "}
                <Link href={`/quiz/attempts/${attempt.id}`}>Open page</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h3>Attempt comparison</h3>
        {!comparison ? (
          <p>
            Need at least two submitted attempts in the selected timeframe to compare performance
            shifts.
          </p>
        ) : (
          <>
            <p>
              Current: {comparison.currentAttempt.scorePercent ?? "N/A"}% (
              {new Date(comparison.currentAttempt.submittedAt).toLocaleString()})
              <br />
              Previous: {comparison.previousAttempt.scorePercent ?? "N/A"}% (
              {new Date(comparison.previousAttempt.submittedAt).toLocaleString()})
              <br />
              Score delta:{" "}
              {comparison.scoreDeltaPercent === null ? "N/A" : `${comparison.scoreDeltaPercent}%`}
            </p>

            <h4>By question type</h4>
            <ul>
              {comparison.byQuestionType.map((typeDelta) => (
                <li key={typeDelta.type}>
                  {typeDelta.type}: {typeDelta.currentAccuracyPercent ?? "N/A"}% vs{" "}
                  {typeDelta.previousAccuracyPercent ?? "N/A"}% (delta{" "}
                  {typeDelta.deltaPercent === null ? "N/A" : `${typeDelta.deltaPercent}%`})
                </li>
              ))}
            </ul>

            <h4>Weak concept shifts</h4>
            {comparison.weakConceptDeltas.length === 0 ? (
              <p>No concept-linked misses across the compared attempts.</p>
            ) : (
              <ul>
                {comparison.weakConceptDeltas.map((conceptDelta) => (
                  <li key={conceptDelta.conceptId}>
                    <Link href={`/learn/${conceptDelta.conceptId}`}>{conceptDelta.conceptTitle}</Link>:{" "}
                    {conceptDelta.currentIncorrectCount} vs {conceptDelta.previousIncorrectCount} (delta{" "}
                    {conceptDelta.deltaIncorrectCount > 0 ? "+" : ""}
                    {conceptDelta.deltaIncorrectCount})
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
