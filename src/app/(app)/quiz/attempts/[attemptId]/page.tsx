import Link from "next/link";
import { notFound } from "next/navigation";

import { readSession } from "@/lib/auth/session";
import { executeQuery, quizAttemptAnswerQueries, quizAttemptQueries } from "@/lib/db";

interface AttemptDetailPageProps {
  params: Promise<{ attemptId: string }>;
}

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type QuestionType = "mcq" | "true_false" | "short_answer";

interface ScoredAttemptRow extends Record<string, unknown> {
  question_type: QuestionType;
  is_correct: boolean | null;
  concept_id: string | null;
  concept_title: string | null;
}

const accuracyPercent = (rows: ScoredAttemptRow[]) => {
  if (rows.length === 0) {
    return null;
  }
  const correct = rows.filter((row) => row.is_correct === true).length;
  return Number(((correct / rows.length) * 100).toFixed(2));
};

const weakConceptMap = (rows: ScoredAttemptRow[]) => {
  const map = new Map<string, { conceptTitle: string; incorrectCount: number }>();
  rows.forEach((row) => {
    if (row.is_correct !== false || !row.concept_id) {
      return;
    }
    const existing = map.get(row.concept_id);
    if (existing) {
      existing.incorrectCount += 1;
      return;
    }
    map.set(row.concept_id, {
      conceptTitle: row.concept_title ?? "Concept",
      incorrectCount: 1
    });
  });
  return map;
};

export default async function AttemptDetailPage({ params }: AttemptDetailPageProps) {
  const session = await readSession();
  if (!session) {
    notFound();
  }

  const { attemptId } = await params;
  if (!uuidRegex.test(attemptId)) {
    notFound();
  }

  const attemptResult = await executeQuery<{
    id: string;
    quiz_id: string;
    quiz_title: string | null;
    status: "in_progress" | "submitted";
    score_percent: string | null;
    correct_count: number | null;
    total_questions: number | null;
    submitted_at: string | null;
  }>(quizAttemptQueries.findByIdForUser(attemptId, session.userId));
  const attempt = attemptResult.rows[0];
  if (!attempt) {
    notFound();
  }

  if (attempt.status !== "submitted") {
    return (
      <section className="panel">
        <p>
          <Link href="/quiz">Back to quiz workspace</Link>
        </p>
        <h2>Attempt review</h2>
        <p>This attempt is still in progress and does not have review data yet.</p>
      </section>
    );
  }

  const reviewResult = await executeQuery<{
    quiz_question_id: string;
    answer_text: string | null;
    is_correct: boolean | null;
    prompt: string;
    explanation: string;
    correct_answer_text: string;
    question_type: "mcq" | "true_false" | "short_answer";
    position: number;
    concept_id: string | null;
    concept_title: string | null;
    selected_option_text: string | null;
  }>(quizAttemptAnswerQueries.listReviewByAttemptForUser(attemptId, session.userId));
  const currentScoredRows = reviewResult.rows.map((row) => ({
    question_type: row.question_type,
    is_correct: row.is_correct,
    concept_id: row.concept_id,
    concept_title: row.concept_title
  }));

  const previousAttempt =
    attempt.submitted_at === null
      ? null
      : (
          await executeQuery<{
            id: string;
            score_percent: string | null;
            submitted_at: string;
          }>(
            quizAttemptQueries.findPreviousSubmittedForQuizForUser(
              attempt.quiz_id,
              session.userId,
              attempt.submitted_at
            )
          )
        ).rows[0] ?? null;

  const previousScoredRows = previousAttempt
    ? (
        await executeQuery<ScoredAttemptRow>(
          quizAttemptAnswerQueries.listScoredByAttemptForUser(previousAttempt.id, session.userId)
        )
      ).rows
    : [];

  const questionTypes: QuestionType[] = ["mcq", "true_false", "short_answer"];
  const byTypeComparison = questionTypes.map((type) => {
    const currentTypeRows = currentScoredRows.filter((row) => row.question_type === type);
    const previousTypeRows = previousScoredRows.filter((row) => row.question_type === type);
    const currentAccuracy = accuracyPercent(currentTypeRows);
    const previousAccuracy = accuracyPercent(previousTypeRows);
    return {
      type,
      currentAccuracy,
      previousAccuracy,
      delta:
        currentAccuracy === null || previousAccuracy === null
          ? null
          : Number((currentAccuracy - previousAccuracy).toFixed(2))
    };
  });

  const currentWeak = weakConceptMap(currentScoredRows);
  const previousWeak = weakConceptMap(previousScoredRows);
  const weakConceptIds = new Set([...currentWeak.keys(), ...previousWeak.keys()]);
  const weakConceptDeltas = [...weakConceptIds]
    .map((conceptId) => {
      const current = currentWeak.get(conceptId);
      const previous = previousWeak.get(conceptId);
      return {
        conceptId,
        conceptTitle: current?.conceptTitle ?? previous?.conceptTitle ?? "Concept",
        currentIncorrect: current?.incorrectCount ?? 0,
        previousIncorrect: previous?.incorrectCount ?? 0,
        deltaIncorrect: (current?.incorrectCount ?? 0) - (previous?.incorrectCount ?? 0)
      };
    })
    .sort((a, b) => Math.abs(b.deltaIncorrect) - Math.abs(a.deltaIncorrect))
    .slice(0, 5);
  const currentScore =
    attempt.score_percent === null ? null : Number.parseFloat(attempt.score_percent);
  const previousScore =
    previousAttempt?.score_percent === null || previousAttempt === null
      ? null
      : Number.parseFloat(previousAttempt.score_percent);
  const scoreDelta =
    currentScore === null || previousScore === null
      ? null
      : Number((currentScore - previousScore).toFixed(2));

  return (
    <section className="space-y-4">
      <section className="panel">
        <p>
          <Link href="/quiz">Back to quiz workspace</Link>
        </p>
        <h2>Attempt review</h2>
        <p>
          Quiz: {attempt.quiz_title ?? attempt.quiz_id}
          <br />
          Score: {attempt.score_percent ?? "0"}% ({attempt.correct_count ?? 0}/
          {attempt.total_questions ?? reviewResult.rows.length})
          <br />
          Submitted:{" "}
          {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "n/a"}
        </p>
      </section>

      <section className="panel">
        <h3>Question-by-question evaluation</h3>
        {reviewResult.rows.length === 0 ? (
          <p>No answer records found for this attempt.</p>
        ) : (
          <ul>
            {reviewResult.rows.map((item) => (
              <li key={item.quiz_question_id}>
                <p>
                  <strong>
                    Q{item.position} ({item.question_type})
                  </strong>{" "}
                  - {item.is_correct ? "Correct" : "Incorrect"}
                </p>
                <p>{item.prompt}</p>
                <p>
                  <strong>Submitted:</strong>{" "}
                  {item.selected_option_text ?? item.answer_text ?? "(no answer)"}
                </p>
                <p>
                  <strong>Expected:</strong> {item.correct_answer_text}
                </p>
                <p>
                  <strong>Why:</strong> {item.explanation}
                </p>
                {item.concept_id ? (
                  <p>
                    <Link href={`/learn/${item.concept_id}`}>
                      Review concept: {item.concept_title ?? "Concept"}
                    </Link>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h3>Compared to previous attempt</h3>
        {!previousAttempt ? (
          <p>No earlier submitted attempt found for this quiz.</p>
        ) : (
          <>
            <p>
              Current: {currentScore ?? "N/A"}%
              <br />
              Previous: {previousScore ?? "N/A"}% (
              {new Date(previousAttempt.submitted_at).toLocaleString()})
              <br />
              Delta: {scoreDelta === null ? "N/A" : `${scoreDelta}%`}
            </p>
            <p>
              <Link href={`/quiz/attempts/${previousAttempt.id}`}>Open previous attempt details</Link>
            </p>

            <h4>By question type</h4>
            <ul>
              {byTypeComparison.map((typeRow) => (
                <li key={typeRow.type}>
                  {typeRow.type}: {typeRow.currentAccuracy ?? "N/A"}% vs{" "}
                  {typeRow.previousAccuracy ?? "N/A"}% (delta{" "}
                  {typeRow.delta === null ? "N/A" : `${typeRow.delta}%`})
                </li>
              ))}
            </ul>

            <h4>Weak concept shifts</h4>
            {weakConceptDeltas.length === 0 ? (
              <p>No concept-linked misses across these two attempts.</p>
            ) : (
              <ul>
                {weakConceptDeltas.map((conceptDelta) => (
                  <li key={conceptDelta.conceptId}>
                    <Link href={`/learn/${conceptDelta.conceptId}`}>{conceptDelta.conceptTitle}</Link>:{" "}
                    {conceptDelta.currentIncorrect} vs {conceptDelta.previousIncorrect} (delta{" "}
                    {conceptDelta.deltaIncorrect > 0 ? "+" : ""}
                    {conceptDelta.deltaIncorrect})
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </section>
  );
}
