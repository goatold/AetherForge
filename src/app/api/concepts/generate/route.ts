import { NextResponse } from "next/server";

import { readSession } from "@/lib/auth/session";
import { DIFFICULTY_LEVELS } from "@/lib/contracts/domain";
import {
  conceptArtifactQueries,
  conceptExampleQueries,
  conceptQueries,
  getDbPool,
  workspaceQueries
} from "@/lib/db";

type ExampleType = "example" | "case_study";

interface ConceptExampleInput {
  type: ExampleType;
  title: string;
  body: string;
}

interface ConceptNodeInput {
  title: string;
  summary: string;
  examples: ConceptExampleInput[];
}

interface GenerationRequest {
  topic: string;
  difficulty: (typeof DIFFICULTY_LEVELS)[number];
}

interface GenerationPayload {
  artifactVersion: number;
  provider: string;
  model: string;
  nodes: ConceptNodeInput[];
}

const isDifficulty = (
  value: string
): value is (typeof DIFFICULTY_LEVELS)[number] =>
  DIFFICULTY_LEVELS.includes(value as (typeof DIFFICULTY_LEVELS)[number]);

const parseRequest = (value: unknown): GenerationRequest | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const body = value as Record<string, unknown>;
  if (typeof body.topic !== "string" || typeof body.difficulty !== "string") {
    return null;
  }

  const topic = body.topic.trim();
  if (!topic || topic.length > 120 || !isDifficulty(body.difficulty)) {
    return null;
  }

  return {
    topic,
    difficulty: body.difficulty
  };
};

const isValidExample = (example: ConceptExampleInput) =>
  (example.type === "example" || example.type === "case_study") &&
  Boolean(example.title.trim()) &&
  Boolean(example.body.trim());

const validatePayload = (payload: GenerationPayload): GenerationPayload | null => {
  if (!Number.isInteger(payload.artifactVersion) || payload.artifactVersion < 1) {
    return null;
  }

  if (!payload.provider.trim() || !payload.model.trim()) {
    return null;
  }

  if (!Array.isArray(payload.nodes) || payload.nodes.length === 0) {
    return null;
  }

  const allNodesValid = payload.nodes.every(
    (node) =>
      Boolean(node.title.trim()) &&
      Boolean(node.summary.trim()) &&
      Array.isArray(node.examples) &&
      node.examples.length > 0 &&
      node.examples.every(isValidExample)
  );

  return allNodesValid ? payload : null;
};

const generatePayload = (
  topic: string,
  difficulty: (typeof DIFFICULTY_LEVELS)[number]
): GenerationPayload => ({
  artifactVersion: 1,
  provider: "aetherforge-bootstrap",
  model: "phase2-template-v1",
  nodes: [
    {
      title: `${topic}: Core mental model`,
      summary: `Build a ${difficulty} understanding of the foundational model behind ${topic}.`,
      examples: [
        {
          type: "example",
          title: "Simple walkthrough",
          body: `Step through a compact ${topic} scenario and explain each decision point.`
        },
        {
          type: "case_study",
          title: "Real-world application",
          body: `Analyze a practical ${topic} tradeoff and justify why one approach fits better.`
        }
      ]
    },
    {
      title: `${topic}: Failure modes`,
      summary: `Map common mistakes in ${topic} and the signals that reveal them early.`,
      examples: [
        {
          type: "example",
          title: "Misconfiguration check",
          body: `Review a broken setup and identify the first indicator that behavior drifted.`
        },
        {
          type: "case_study",
          title: "Incident retrospective",
          body: `Summarize a realistic incident where ${topic} assumptions failed in production.`
        }
      ]
    }
  ]
});

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

  const parsedRequest = parseRequest(rawBody);
  if (!parsedRequest) {
    return NextResponse.json(
      { error: "Expected topic and difficulty in request body" },
      { status: 400 }
    );
  }

  const workspaceResult = await getDbPool().query<{
    id: string;
  }>(workspaceQueries.listForUser(session.userId).text, [session.userId]);
  const workspace = workspaceResult.rows[0];

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const payload = validatePayload(
    generatePayload(parsedRequest.topic, parsedRequest.difficulty)
  );
  if (!payload) {
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

    const insertedConcepts: Array<{ id: string; title: string }> = [];
    for (const node of payload.nodes) {
      const conceptResult = await client.query<{ id: string; title: string }>(
        conceptQueries.insert(workspace.id, node.title, node.summary).text,
        [workspace.id, node.title, node.summary]
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
      artifactId: artifactResult.rows[0]?.id ?? null,
      concepts: insertedConcepts
    });
  } catch {
    await client.query("rollback");
    return NextResponse.json({ error: "Failed to generate concepts" }, { status: 500 });
  } finally {
    client.release();
  }
}
