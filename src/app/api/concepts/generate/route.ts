import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import { generateConceptPayload } from "@/lib/ai/generate-concepts";
import { getConnectedAiProviderSession } from "@/lib/ai/provider-session";
import { logger, recordError } from "@/lib/observability";
import {
  parseGenerationRequest,
  validateGenerationPayload
} from "@/lib/ai/concepts";
import {
  conceptArtifactQueries,
  conceptExampleQueries,
  conceptQueries,
  executeQuery,
  getDbPool,
  workspaceQueries
} from "@/lib/db";

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

  const parsedRequest = parseGenerationRequest(rawBody);
  if (!parsedRequest) {
    return NextResponse.json(
      { error: "Expected topic and difficulty in request body" },
      { status: 400 }
    );
  }

  const workspaceResult = await executeQuery<{
    id: string;
  }>(workspaceQueries.listForUser(session.userId));
  const workspace = workspaceResult.rows[0];

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  logger.info("Concept generation started", {
    workspaceId: workspace.id,
    topic: parsedRequest.topic,
    difficulty: parsedRequest.difficulty
  });

  const aiSession = await getConnectedAiProviderSession(session.userId);
  if (!aiSession) {
    return NextResponse.json(
      { error: "AI provider is not connected. Visit /ai-connect and complete manual web login." },
      { status: 409 }
    );
  }

  const generated = await generateConceptPayload(
    parsedRequest.topic,
    parsedRequest.difficulty,
    aiSession
  );
  const payload = validateGenerationPayload(generated.payload);
  if (!payload) {
    recordError("concept_generation_validation", new Error("Generated payload failed validation"), {
      workspaceId: workspace.id
    });
    return NextResponse.json({ error: "Generated payload failed validation" }, { status: 500 });
  }

  const db = getDbPool();
  const client = await db.connect();

  try {
    await client.query("begin");

    const artifactResult = await client.query<{
      id: string;
    }>(
      conceptArtifactQueries.insert(
        workspace.id,
        parsedRequest.topic,
        parsedRequest.difficulty,
        payload.artifactVersion,
        payload.provider,
        payload.model,
        session.userId
      ).text,
      [
        workspace.id,
        parsedRequest.topic,
        parsedRequest.difficulty,
        payload.artifactVersion,
        payload.provider,
        payload.model,
        session.userId
      ]
    );
    const artifactId = artifactResult.rows[0]?.id;
    if (!artifactId) {
      throw new Error("Failed to persist artifact");
    }

    const insertedConcepts: Array<{ id: string; title: string }> = [];
    for (const node of payload.nodes) {
      const conceptResult = await client.query<{ id: string; title: string }>(
        conceptQueries.insertForArtifact(
          workspace.id,
          artifactId,
          node.title,
          node.summary
        ).text,
        [workspace.id, artifactId, node.title, node.summary]
      );
      const concept = conceptResult.rows[0];
      if (!concept) {
        throw new Error("Failed to persist concept");
      }

      for (const example of node.examples) {
        await client.query(
          conceptExampleQueries.insert(
            concept.id,
            example.type,
            example.title,
            example.body
          ).text,
          [concept.id, example.type, example.title, example.body]
        );
      }

      insertedConcepts.push(concept);
    }

    await client.query("commit");

    return NextResponse.json({
      artifactId,
      concepts: insertedConcepts,
      generationPath: generated.generationPath
    });
  } catch {
    await client.query("rollback");
    return NextResponse.json({ error: "Failed to generate concepts" }, { status: 500 });
  } finally {
    client.release();
  }
}
