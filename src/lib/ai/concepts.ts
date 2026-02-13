import { DIFFICULTY_LEVELS } from "@/lib/contracts/domain";

export type ExampleType = "example" | "case_study";

export interface ConceptExampleInput {
  type: ExampleType;
  title: string;
  body: string;
}

export interface ConceptNodeInput {
  title: string;
  summary: string;
  examples: ConceptExampleInput[];
}

export interface GenerationRequest {
  topic: string;
  difficulty: (typeof DIFFICULTY_LEVELS)[number];
}

export interface GenerationPayload {
  artifactVersion: number;
  provider: string;
  model: string;
  nodes: ConceptNodeInput[];
}

const isDifficulty = (
  value: string
): value is (typeof DIFFICULTY_LEVELS)[number] =>
  DIFFICULTY_LEVELS.includes(value as (typeof DIFFICULTY_LEVELS)[number]);

export const parseGenerationRequest = (value: unknown): GenerationRequest | null => {
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

export const validateGenerationPayload = (
  payload: GenerationPayload
): GenerationPayload | null => {
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

export const generateBootstrapConceptPayload = (
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
