import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import { executeQuery, quizAttemptAnswerQueries, quizAttemptQueries, workspaceQueries } from "@/lib/db";

const ALLOWED_TIMEFRAMES = [7, 14, 30, 90] as const;

const parseTimeframe = (value: string | null): number => {
  if (!value) {
    return 30;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || !ALLOWED_TIMEFRAMES.includes(parsed as (typeof ALLOWED_TIMEFRAMES)[number])) {
    return 30;
  }
  return parsed;
};

type QuestionType = "mcq" | "true_false" | "short_answer";

interface ScoredRow extends Record<string, unknown> {
  quiz_question_id: string;
  is_correct: boolean | null;
  question_type: QuestionType;
  concept_id: string | null;
  concept_title: string | null;
}

const accuracyPercent = (rows: ScoredRow[]) => {
  if (rows.length === 0) {
    return null;
  }
  const correct = rows.filter((row) => row.is_correct === true).length;
  return Number(((correct / rows.length) * 100).toFixed(2));
};

const byTypeAccuracy = (rows: ScoredRow[]) => {
  const types: QuestionType[] = ["mcq", "true_false", "short_answer"];
  return types.map((type) => {
    const subset = rows.filter((row) => row.question_type === type);
    return {
      type,
      accuracyPercent: accuracyPercent(subset),
      total: subset.length
    };
  });
};

const weakConceptMap = (rows: ScoredRow[]) => {
  const map = new Map<string, { conceptId: string; conceptTitle: string; incorrectCount: number }>();
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
      conceptId: row.concept_id,
      conceptTitle: row.concept_title ?? "Concept",
      incorrectCount: 1
    });
  });
  return map;
};

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceResult = await executeQuery<{ id: string }>(workspaceQueries.listForUser(session.userId));
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return NextResponse.json({ comparison: null, timeframeDays: 30 });
  }

  const { searchParams } = new URL(request.url);
  const timeframeDays = parseTimeframe(searchParams.get("timeframeDays"));
  const attemptsResult = await executeQuery<{
    id: string;
    score_percent: string | null;
    submitted_at: string;
  }>(quizAttemptQueries.listRecentByWorkspaceForUserSince(workspace.id, session.userId, 2, timeframeDays));

  const currentAttempt = attemptsResult.rows[0];
  const previousAttempt = attemptsResult.rows[1];
  if (!currentAttempt || !previousAttempt) {
    return NextResponse.json({
      timeframeDays,
      comparison: null
    });
  }

  const [currentRowsResult, previousRowsResult] = await Promise.all([
    executeQuery<ScoredRow>(quizAttemptAnswerQueries.listScoredByAttemptForUser(currentAttempt.id, session.userId)),
    executeQuery<ScoredRow>(quizAttemptAnswerQueries.listScoredByAttemptForUser(previousAttempt.id, session.userId))
  ]);
  const currentRows = currentRowsResult.rows;
  const previousRows = previousRowsResult.rows;

  const currentByType = byTypeAccuracy(currentRows);
  const previousByType = byTypeAccuracy(previousRows);
  const byTypeDeltas = currentByType.map((currentItem) => {
    const previousItem = previousByType.find((item) => item.type === currentItem.type);
    const previousAccuracy = previousItem?.accuracyPercent ?? null;
    return {
      type: currentItem.type,
      currentAccuracyPercent: currentItem.accuracyPercent,
      previousAccuracyPercent: previousAccuracy,
      deltaPercent:
        currentItem.accuracyPercent === null || previousAccuracy === null
          ? null
          : Number((currentItem.accuracyPercent - previousAccuracy).toFixed(2)),
      currentTotal: currentItem.total,
      previousTotal: previousItem?.total ?? 0
    };
  });

  const currentWeak = weakConceptMap(currentRows);
  const previousWeak = weakConceptMap(previousRows);
  const conceptIds = new Set([...currentWeak.keys(), ...previousWeak.keys()]);
  const weakConceptDeltas = [...conceptIds]
    .map((conceptId) => {
      const current = currentWeak.get(conceptId);
      const previous = previousWeak.get(conceptId);
      return {
        conceptId,
        conceptTitle: current?.conceptTitle ?? previous?.conceptTitle ?? "Concept",
        currentIncorrectCount: current?.incorrectCount ?? 0,
        previousIncorrectCount: previous?.incorrectCount ?? 0,
        deltaIncorrectCount: (current?.incorrectCount ?? 0) - (previous?.incorrectCount ?? 0)
      };
    })
    .sort((a, b) => Math.abs(b.deltaIncorrectCount) - Math.abs(a.deltaIncorrectCount))
    .slice(0, 5);

  const currentScore =
    currentAttempt.score_percent === null ? null : Number.parseFloat(currentAttempt.score_percent);
  const previousScore =
    previousAttempt.score_percent === null ? null : Number.parseFloat(previousAttempt.score_percent);

  return NextResponse.json({
    timeframeDays,
    comparison: {
      currentAttempt: {
        id: currentAttempt.id,
        scorePercent: currentScore,
        submittedAt: currentAttempt.submitted_at
      },
      previousAttempt: {
        id: previousAttempt.id,
        scorePercent: previousScore,
        submittedAt: previousAttempt.submitted_at
      },
      scoreDeltaPercent:
        currentScore === null || previousScore === null
          ? null
          : Number((currentScore - previousScore).toFixed(2)),
      byQuestionType: byTypeDeltas,
      weakConceptDeltas
    }
  });
}
