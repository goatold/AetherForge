import { NextResponse } from "next/server";

import { generateQuizPayload } from "@/lib/ai/generate-quiz";
import { readSession } from "@/lib/auth/session";
import {
  conceptArtifactQueries,
  conceptQueries,
  executeQuery,
  getDbPool,
  quizQueries,
  quizQuestionOptionQueries,
  quizQuestionQueries,
  workspaceQueries
} from "@/lib/db";
import { DIFFICULTY_LEVELS } from "@/lib/contracts/domain";

const isDifficulty = (value: string): value is (typeof DIFFICULTY_LEVELS)[number] =>
  DIFFICULTY_LEVELS.includes(value as (typeof DIFFICULTY_LEVELS)[number]);

interface GenerateQuizRequestBody {
  conceptIds?: string[];
}

const parseBody = (value: unknown): GenerateQuizRequestBody => {
  if (!value || typeof value !== "object") {
    return {};
  }
  const raw = value as { conceptIds?: unknown };
  if (!Array.isArray(raw.conceptIds)) {
    return {};
  }
  const conceptIds = raw.conceptIds
    .filter((item): item is string => typeof item === "string")
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .slice(0, 8);
  return { conceptIds };
};

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown = null;
  try {
    rawBody = await request.json();
  } catch {
    rawBody = null;
  }
  const body = parseBody(rawBody);

  const workspaceResult = await executeQuery<{
    id: string;
    topic: string;
    difficulty: string;
  }>(workspaceQueries.listForUser(session.userId));
  const workspace = workspaceResult.rows[0];
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const artifactsResult = await executeQuery<{ id: string }>(
    conceptArtifactQueries.listByWorkspace(workspace.id)
  );
  const latestArtifactId = artifactsResult.rows[0]?.id ?? null;

  const baseConceptsResult = latestArtifactId
    ? await executeQuery<{ id: string; title: string; summary: string }>(
        conceptQueries.listByArtifactForUser(latestArtifactId, session.userId)
      )
    : await executeQuery<{ id: string; title: string; summary: string }>(
        conceptQueries.listByWorkspace(workspace.id)
      );

  if (baseConceptsResult.rows.length === 0) {
    return NextResponse.json(
      { error: "Generate concepts in Learn before creating a quiz." },
      { status: 400 }
    );
  }

  const conceptsResult =
    body.conceptIds && body.conceptIds.length > 0
      ? await executeQuery<{ id: string; title: string; summary: string }>(
          conceptQueries.listByIdsForUser(body.conceptIds, session.userId)
        )
      : baseConceptsResult;
  if (conceptsResult.rows.length === 0) {
    return NextResponse.json(
      { error: "Requested targeted concepts were not found for this workspace." },
      { status: 400 }
    );
  }

  const difficulty = isDifficulty(workspace.difficulty) ? workspace.difficulty : "beginner";
  const payload = await generateQuizPayload(
    workspace.topic,
    difficulty,
    conceptsResult.rows
  );
  const quizTitle =
    body.conceptIds && body.conceptIds.length > 0
      ? `Targeted retry: ${workspace.topic}`
      : payload.title;

  const db = getDbPool();
  const client = await db.connect();
  try {
    await client.query("begin");

    const quizResult = await client.query<{
      id: string;
      title: string;
      provider: string;
      model: string;
      created_at: string;
    }>(
      quizQueries.insert(
        workspace.id,
        quizTitle,
        latestArtifactId,
        payload.provider,
        payload.model
      ).text,
      [workspace.id, quizTitle, latestArtifactId, payload.provider, payload.model]
    );
    const quiz = quizResult.rows[0];
    if (!quiz) {
      throw new Error("Failed to create quiz");
    }

    for (const [index, question] of payload.questions.entries()) {
      const questionResult = await client.query<{ id: string }>(
        quizQuestionQueries.insert(
          quiz.id,
          question.conceptId,
          question.type,
          question.prompt,
          question.explanation,
          question.correctAnswerText,
          index + 1
        ).text,
        [
          quiz.id,
          question.conceptId,
          question.type,
          question.prompt,
          question.explanation,
          question.correctAnswerText,
          index + 1
        ]
      );
      const createdQuestion = questionResult.rows[0];
      if (!createdQuestion) {
        throw new Error("Failed to create quiz question");
      }

      for (const [optionIndex, option] of question.options.entries()) {
        await client.query(
          quizQuestionOptionQueries.insert(
            createdQuestion.id,
            option.key,
            option.text,
            option.isCorrect,
            optionIndex + 1
          ).text,
          [createdQuestion.id, option.key, option.text, option.isCorrect, optionIndex + 1]
        );
      }
    }

    await client.query("commit");
    return NextResponse.json({ quizId: quiz.id });
  } catch {
    await client.query("rollback");
    return NextResponse.json({ error: "Failed to generate quiz" }, { status: 500 });
  } finally {
    client.release();
  }
}
