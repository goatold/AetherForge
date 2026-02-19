import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import {
  executeQuery,
  flashcardQueries,
  flashcardReviewQueries
} from "@/lib/db";
import { scheduleNextReview } from "@/lib/srs/scheduler";

interface ReviewRequestBody {
  flashcardId?: string;
  recallScore?: number;
}

const isRecallScore = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 5;

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
  const body = rawBody as ReviewRequestBody;
  if (!body.flashcardId || typeof body.flashcardId !== "string") {
    return NextResponse.json({ error: "flashcardId is required" }, { status: 400 });
  }
  if (!isRecallScore(body.recallScore)) {
    return NextResponse.json({ error: "recallScore must be a number between 0 and 5" }, { status: 400 });
  }

  const flashcardResult = await executeQuery<{
    id: string;
    ease_factor: string;
    interval_days: number;
    repetition_count: number;
  }>(flashcardQueries.findByIdForUser(body.flashcardId, session.userId));
  const flashcard = flashcardResult.rows[0];
  if (!flashcard) {
    return NextResponse.json({ error: "Flashcard not found" }, { status: 404 });
  }

  const schedule = scheduleNextReview({
    recallScore: body.recallScore,
    easeFactor: Number.parseFloat(flashcard.ease_factor),
    intervalDays: flashcard.interval_days,
    repetitionCount: flashcard.repetition_count
  });
  const nextReviewAtIso = schedule.nextReviewAt.toISOString();

  const [updatedFlashcardResult, reviewResult] = await Promise.all([
    executeQuery(
      flashcardQueries.applyReviewUpdate(
        flashcard.id,
        schedule.easeFactor,
        schedule.intervalDays,
        schedule.repetitionCount,
        nextReviewAtIso
      )
    ),
    executeQuery(
      flashcardReviewQueries.insert(
        flashcard.id,
        session.userId,
        body.recallScore,
        schedule.intervalDays,
        nextReviewAtIso
      )
    )
  ]);

  return NextResponse.json({
    flashcard: updatedFlashcardResult.rows[0] ?? null,
    review: reviewResult.rows[0] ?? null
  });
}
