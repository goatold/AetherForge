import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import {
  conceptQueries,
  executeQuery,
  getDbPool,
  quizAttemptAnswerQueries,
  quizAttemptQueries,
  quizQuestionOptionQueries,
  quizQuestionQueries
} from "@/lib/db";

interface AttemptResponseInput {
  questionId: string;
  selectedOptionId?: string | null;
  answerText?: string | null;
}

interface SubmitAttemptRequest {
  responses?: AttemptResponseInput[];
}

interface AttemptRouteProps {
  params: Promise<{ attemptId: string }>;
}

const normalizeText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

const isShortAnswerCorrect = (submitted: string, expected: string) => {
  const normalizedSubmitted = normalizeText(submitted);
  const normalizedExpected = normalizeText(expected);
  if (!normalizedSubmitted || !normalizedExpected) {
    return false;
  }
  if (normalizedSubmitted.includes(normalizedExpected)) {
    return true;
  }

  const expectedTokens = normalizedExpected
    .split(" ")
    .filter((token) => token.length > 4)
    .slice(0, 4);
  if (expectedTokens.length === 0) {
    return false;
  }
  const matchingTokens = expectedTokens.filter((token) => normalizedSubmitted.includes(token));
  return matchingTokens.length >= Math.ceil(expectedTokens.length / 2);
};

export async function POST(request: Request, { params }: AttemptRouteProps) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { attemptId } = await params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const body = rawBody as SubmitAttemptRequest;
  if (!Array.isArray(body.responses)) {
    return NextResponse.json({ error: "responses must be an array" }, { status: 400 });
  }

  const attemptResult = await executeQuery<{
    id: string;
    quiz_id: string;
    status: "in_progress" | "submitted";
  }>(quizAttemptQueries.findByIdForUser(attemptId, session.userId));
  const attempt = attemptResult.rows[0];
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }
  if (attempt.status !== "in_progress") {
    return NextResponse.json({ error: "Attempt already submitted" }, { status: 409 });
  }

  const [questionResult, optionResult] = await Promise.all([
    executeQuery<{
      id: string;
      concept_id: string | null;
      prompt: string;
      question_type: "mcq" | "true_false" | "short_answer";
      correct_answer_text: string;
    }>(quizQuestionQueries.listByQuiz(attempt.quiz_id)),
    executeQuery<{
      id: string;
      quiz_question_id: string;
      option_text: string;
      is_correct: boolean;
    }>(quizQuestionOptionQueries.listByQuiz(attempt.quiz_id))
  ]);

  const responseMap = new Map(body.responses.map((response) => [response.questionId, response]));
  const optionsByQuestion = optionResult.rows.reduce<Record<string, typeof optionResult.rows>>(
    (acc, option) => {
      const bucket = acc[option.quiz_question_id] ?? [];
      bucket.push(option);
      acc[option.quiz_question_id] = bucket;
      return acc;
    },
    {}
  );

  let correctCount = 0;
  let answeredCount = 0;
  const weakConceptCounts = new Map<string, number>();

  const db = getDbPool();
  const client = await db.connect();
  try {
    await client.query("begin");

    for (const question of questionResult.rows) {
      const response = responseMap.get(question.id);
      if (!response) {
        continue;
      }
      answeredCount += 1;

      const options = optionsByQuestion[question.id] ?? [];
      let selectedOptionId: string | null = null;
      let answerText: string | null = null;
      let isCorrect = false;

      if (question.question_type === "short_answer") {
        answerText = typeof response.answerText === "string" ? response.answerText : null;
        if (answerText) {
          isCorrect = isShortAnswerCorrect(answerText, question.correct_answer_text);
        }
      } else {
        selectedOptionId =
          typeof response.selectedOptionId === "string" ? response.selectedOptionId : null;
        const selectedOption = options.find((option) => option.id === selectedOptionId);
        if (selectedOption) {
          answerText = selectedOption.option_text;
          isCorrect = selectedOption.is_correct;
        }
      }

      if (isCorrect) {
        correctCount += 1;
      } else if (question.concept_id) {
        weakConceptCounts.set(question.concept_id, (weakConceptCounts.get(question.concept_id) ?? 0) + 1);
      }

      await client.query(
        quizAttemptAnswerQueries.upsert(
          attempt.id,
          question.id,
          selectedOptionId,
          answerText,
          isCorrect
        ).text,
        [attempt.id, question.id, selectedOptionId, answerText, isCorrect]
      );
    }

    const totalQuestions = questionResult.rows.length;
    const scorePercent =
      totalQuestions === 0 ? 0 : Number(((correctCount / totalQuestions) * 100).toFixed(2));

    const submittedResult = await client.query<{
      id: string;
      score_percent: string;
      correct_count: number;
      total_questions: number;
      submitted_at: string | null;
    }>(quizAttemptQueries.submit(attempt.id, scorePercent, correctCount, totalQuestions).text, [
      attempt.id,
      scorePercent,
      correctCount,
      totalQuestions
    ]);
    const submitted = submittedResult.rows[0];
    if (!submitted) {
      throw new Error("Failed to submit attempt");
    }

    await client.query("commit");

    const weakConceptIds = [...weakConceptCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([conceptId]) => conceptId);

    const weakAreaQuestions = questionResult.rows.filter((question) =>
      weakConceptIds.includes(question.concept_id ?? "")
    );
    const weakConceptResult =
      weakConceptIds.length > 0
        ? await executeQuery<{ id: string; title: string }>(
            conceptQueries.listByIdsForUser(weakConceptIds, session.userId)
          )
        : { rows: [] as Array<{ id: string; title: string }> };
    const weakConceptTitleById = new Map(
      weakConceptResult.rows.map((concept) => [concept.id, concept.title])
    );
    const weakAreas = weakAreaQuestions.slice(0, 3).map((question) => ({
      conceptId: question.concept_id,
      conceptTitle: question.concept_id
        ? weakConceptTitleById.get(question.concept_id) ?? "Concept"
        : "Concept",
      prompt: question.prompt
    }));

    return NextResponse.json({
      attempt: submitted,
      answeredCount,
      feedback: {
        scorePercent,
        correctCount,
        totalQuestions,
        weakAreas,
        nextActions: [
          "Review concept summaries linked to missed questions.",
          "Regenerate a quiz after reviewing weak areas.",
          "Aim for 80%+ before moving to flashcard scheduling."
        ]
      }
    });
  } catch {
    await client.query("rollback");
    return NextResponse.json({ error: "Failed to submit attempt" }, { status: 500 });
  } finally {
    client.release();
  }
}
