import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import {
  executeQuery,
  quizAttemptQueries,
  quizQueries,
  quizQuestionOptionQueries,
  quizQuestionQueries
} from "@/lib/db";

interface StartAttemptRequest {
  quizId?: string;
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const body = rawBody as StartAttemptRequest;
  if (!body.quizId || typeof body.quizId !== "string") {
    return NextResponse.json({ error: "quizId is required" }, { status: 400 });
  }

  const quizResult = await executeQuery<{ id: string; title: string }>(
    quizQueries.findByIdForUser(body.quizId, session.userId)
  );
  const quiz = quizResult.rows[0];
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const attemptResult = await executeQuery<{
    id: string;
    status: "in_progress" | "submitted";
    started_at: string;
  }>(quizAttemptQueries.start(quiz.id, session.userId));
  const attempt = attemptResult.rows[0];
  if (!attempt) {
    return NextResponse.json({ error: "Could not create attempt" }, { status: 500 });
  }

  const [questionResult, optionResult] = await Promise.all([
    executeQuery<{
      id: string;
      question_type: "mcq" | "true_false" | "short_answer";
      prompt: string;
      explanation: string;
      position: number;
    }>(quizQuestionQueries.listByQuiz(quiz.id)),
    executeQuery<{
      id: string;
      quiz_question_id: string;
      option_key: string;
      option_text: string;
      position: number;
    }>(quizQuestionOptionQueries.listByQuiz(quiz.id))
  ]);

  return NextResponse.json({
    attempt,
    quiz: {
      id: quiz.id,
      title: quiz.title,
      questions: questionResult.rows.map((question) => ({
        id: question.id,
        type: question.question_type,
        prompt: question.prompt,
        explanation: question.explanation,
        position: question.position,
        options: optionResult.rows
          .filter((option) => option.quiz_question_id === question.id)
          .map((option) => ({
            id: option.id,
            key: option.option_key,
            text: option.option_text,
            position: option.position
          }))
      }))
    }
  });
}
