import type { DifficultyLevel } from "@/lib/contracts/domain";
import type { AiProviderSession } from "@/lib/ai/provider-session";
import { logger, recordError } from "@/lib/observability";

import {
  type QuizGenerationConceptInput,
  type QuizGenerationPayload,
  generateBootstrapQuizPayload,
  validateQuizGenerationPayload
} from "./quiz";
import { runBrowserProviderPrompt } from "./browser/providers";
import { withRetries } from "./retry";
import type { AiGenerationPath } from "./generate-concepts";

const browserAutomationEnabled = () => process.env.AI_BROWSER_AUTOMATION === "1";

const buildBrowserPrompt = (
  topic: string,
  difficulty: DifficultyLevel,
  concepts: QuizGenerationConceptInput[]
) =>
  [
    "Return JSON only.",
    "Shape:",
    '{ "title":"string", "questions":[{"conceptId":"string|null","type":"mcq|true_false|short_answer","prompt":"string","explanation":"string","correctAnswerText":"string","options":[{"key":"string","text":"string","isCorrect":true|false}]}] }',
    "Rules:",
    "- 3-8 questions",
    "- include at least one mcq and one true_false",
    "- exactly one correct option for mcq/true_false",
    "- short_answer must have empty options array",
    `Topic: ${topic}`,
    `Difficulty: ${difficulty}`,
    `Concepts JSON: ${JSON.stringify(concepts)}`
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

async function generateViaBrowserDriver(
  topic: string,
  difficulty: DifficultyLevel,
  concepts: QuizGenerationConceptInput[],
  session: AiProviderSession
): Promise<QuizGenerationPayload> {
  const rawJson = await runBrowserProviderPrompt(
    session.providerKey as "chatgpt-web" | "claude-web" | "gemini-web",
    session.userId,
    buildBrowserPrompt(topic, difficulty, concepts)
  );
  const parsed = parsePayload(rawJson, session.providerKey, session.modelHint ?? "chatgpt-web-ui");
  if (!parsed) {
    throw new Error("Browser provider response could not be parsed as quiz JSON.");
  }
  const validated = validateQuizGenerationPayload(parsed);
  if (!validated) {
    throw new Error("Browser provider response failed quiz schema validation.");
  }
  return validated;
}

export async function generateQuizPayload(
  topic: string,
  difficulty: DifficultyLevel,
  concepts: QuizGenerationConceptInput[],
  session: AiProviderSession
): Promise<{ payload: QuizGenerationPayload; generationPath: AiGenerationPath }> {
  if (browserAutomationEnabled()) {
    try {
      const payload = await withRetries(
        () => generateViaBrowserDriver(topic, difficulty, concepts, session),
        { operationName: "quiz_generation_browser_ui", maxAttempts: 2, delayMs: 500 }
      );
      return { payload, generationPath: "browser_driver" };
    } catch (error) {
      recordError("quiz_generation_browser_ui", error, {
        providerKey: session.providerKey,
        mode: session.mode
      });
      logger.warn("Browser automation quiz generation failed; using fallback payload", {
        providerKey: session.providerKey
      });
    }
  }

  const fallback = generateBootstrapQuizPayload(topic, difficulty, concepts);
  return {
    payload: {
      ...fallback,
      provider: session.providerKey,
      model: session.modelHint ?? `${session.mode}-manual`
    },
    generationPath: "fallback"
  };
}
