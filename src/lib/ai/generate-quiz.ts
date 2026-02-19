import { env } from "@/lib/env";
import type { DifficultyLevel } from "@/lib/contracts/domain";

import {
  type QuizGenerationConceptInput,
  type QuizGenerationPayload,
  generateBootstrapQuizPayload,
  validateQuizGenerationPayload
} from "./quiz";

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
    "You generate quiz content as strict JSON.",
    "Return JSON only with this exact shape:",
    "{",
    '  "title": "string",',
    '  "questions": [',
    "    {",
    '      "conceptId": "string|null",',
    '      "type": "mcq|true_false|short_answer",',
    '      "prompt": "string",',
    '      "explanation": "string",',
    '      "correctAnswerText": "string",',
    '      "options": [',
    '        { "key": "string", "text": "string", "isCorrect": true|false }',
    "      ]",
    "    }",
    "  ]",
    "}",
    "Rules:",
    "- Return 3-8 questions.",
    "- Include at least one mcq and one true_false question.",
    "- short_answer questions must have an empty options array.",
    "- mcq and true_false must have exactly one correct option."
  ].join("\n");

const buildUserPrompt = (
  topic: string,
  difficulty: DifficultyLevel,
  concepts: QuizGenerationConceptInput[]
) =>
  [
    `Topic: ${topic}`,
    `Difficulty: ${difficulty}`,
    `Concepts JSON: ${JSON.stringify(concepts)}`,
    "Generate a balanced mixed-type quiz."
  ].join("\n");

const parsePayload = (
  content: string,
  defaultProvider: string,
  defaultModel: string
): QuizGenerationPayload | null => {
  try {
    const parsed = JSON.parse(content) as {
      title?: string;
      questions?: QuizGenerationPayload["questions"];
    };
    if (typeof parsed.title !== "string" || !Array.isArray(parsed.questions)) {
      return null;
    }
    return {
      artifactVersion: 1,
      provider: defaultProvider,
      model: defaultModel,
      title: parsed.title,
      questions: parsed.questions
    };
  } catch {
    return null;
  }
};

async function generateFromOpenAi(
  topic: string,
  difficulty: DifficultyLevel,
  concepts: QuizGenerationConceptInput[]
): Promise<QuizGenerationPayload> {
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
        { role: "user", content: buildUserPrompt(topic, difficulty, concepts) }
      ],
      temperature: 0.2
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

  const parsed = parsePayload(content, "openai", model);
  if (!parsed) {
    throw new Error("OpenAI quiz response could not be parsed");
  }
  const validated = validateQuizGenerationPayload(parsed);
  if (!validated) {
    throw new Error("OpenAI quiz response failed schema validation");
  }

  return validated;
}

export async function generateQuizPayload(
  topic: string,
  difficulty: DifficultyLevel,
  concepts: QuizGenerationConceptInput[]
): Promise<QuizGenerationPayload> {
  if (!env.openAiApiKey) {
    return generateBootstrapQuizPayload(topic, difficulty, concepts);
  }

  try {
    return await generateFromOpenAi(topic, difficulty, concepts);
  } catch {
    return generateBootstrapQuizPayload(topic, difficulty, concepts);
  }
}
