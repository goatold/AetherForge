import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import { executeQuery, quizAttemptAnswerQueries, quizAttemptQueries } from "@/lib/db";

interface AttemptRouteProps {
  params: Promise<{ attemptId: string }>;
}

export async function GET(_request: Request, { params }: AttemptRouteProps) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { attemptId } = await params;

  const attemptResult = await executeQuery<{
    id: string;
    quiz_id: string;
    status: "in_progress" | "submitted";
    score_percent: string | null;
    correct_count: number | null;
    total_questions: number | null;
    submitted_at: string | null;
  }>(quizAttemptQueries.findByIdForUser(attemptId, session.userId));
  const attempt = attemptResult.rows[0];
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }
  if (attempt.status !== "submitted") {
    return NextResponse.json({ error: "Attempt has not been submitted yet" }, { status: 409 });
  }

  const reviewResult = await executeQuery<{
    id: string;
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

  return NextResponse.json({
    attempt,
    review: reviewResult.rows.map((row) => ({
      questionId: row.quiz_question_id,
      position: row.position,
      questionType: row.question_type,
      prompt: row.prompt,
      explanation: row.explanation,
      correctAnswerText: row.correct_answer_text,
      submittedAnswerText: row.selected_option_text ?? row.answer_text ?? "",
      isCorrect: row.is_correct ?? false,
      concept: row.concept_id
        ? {
            id: row.concept_id,
            title: row.concept_title ?? "Concept"
          }
        : null
    }))
  });
}
