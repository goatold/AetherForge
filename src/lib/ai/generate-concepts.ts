import { env } from "@/lib/env";
import type { DifficultyLevel } from "@/lib/contracts/domain";

import {
  type ConceptNodeInput,
  type GenerationPayload,
  generateBootstrapConceptPayload,
  validateGenerationPayload
} from "./concepts";

interface OpenAiChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

const buildSystemPrompt = () =>
  [
    "You generate learning concept graphs as strict JSON.",
    "Return JSON only with this exact shape:",
    "{",
    '  "nodes": [',
    "    {",
    '      "title": "string",',
    '      "summary": "string",',
    '      "examples": [',
    '        { "type": "example", "title": "string", "body": "string" },',
    '        { "type": "case_study", "title": "string", "body": "string" }',
    "      ]",
    "    }",
    "  ]",
    "}",
    "Rules:",
    "- Return 2-5 nodes.",
    "- Each node must include at least two examples.",
    '- Example type must be exactly "example" or "case_study".',
    "- Keep each summary concise and actionable."
  ].join("\n");

const buildUserPrompt = (topic: string, difficulty: DifficultyLevel) =>
  [
    `Topic: ${topic}`,
    `Difficulty: ${difficulty}`,
    "Generate a concept graph suitable for guided learning."
  ].join("\n");

const parseNodesFromModel = (content: string): ConceptNodeInput[] | null => {
  try {
    const parsed = JSON.parse(content) as {
      nodes?: ConceptNodeInput[];
    };
    if (!Array.isArray(parsed.nodes)) {
      return null;
    }
    return parsed.nodes;
  } catch {
    return null;
  }
};

async function generateFromOpenAi(
  topic: string,
  difficulty: DifficultyLevel
): Promise<GenerationPayload> {
  const apiKey = env.openAiApiKey;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const response = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(topic, difficulty) }
      ],
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "concept_graph_payload",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["nodes"],
            properties: {
              nodes: {
                type: "array",
                minItems: 2,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "summary", "examples"],
                  properties: {
                    title: { type: "string", minLength: 1 },
                    summary: { type: "string", minLength: 1 },
                    examples: {
                      type: "array",
                      minItems: 2,
                      items: {
                        type: "object",
                        additionalProperties: false,
                        required: ["type", "title", "body"],
                        properties: {
                          type: { type: "string", enum: ["example", "case_study"] },
                          title: { type: "string", minLength: 1 },
                          body: { type: "string", minLength: 1 }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`);
  }

  const body = (await response.json()) as OpenAiChatResponse;
  const content = body.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI response did not include JSON content");
  }

  const nodes = parseNodesFromModel(content);
  if (!nodes) {
    throw new Error("OpenAI response JSON could not be parsed");
  }

  const payload: GenerationPayload = {
    artifactVersion: 1,
    provider: "openai",
    model,
    nodes
  };
  const validated = validateGenerationPayload(payload);
  if (!validated) {
    throw new Error("OpenAI response failed schema validation");
  }

  return validated;
}

export async function generateConceptPayload(
  topic: string,
  difficulty: DifficultyLevel
): Promise<GenerationPayload> {
  if (!env.openAiApiKey) {
    return generateBootstrapConceptPayload(topic, difficulty);
  }

  return generateFromOpenAi(topic, difficulty);
}
