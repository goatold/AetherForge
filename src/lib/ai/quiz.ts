import type { DifficultyLevel } from "@/lib/contracts/domain";

export type QuizQuestionType = "mcq" | "true_false" | "short_answer";

export interface QuizGenerationConceptInput {
  id: string;
  title: string;
  summary: string;
}

export interface QuizQuestionOptionInput {
  key: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestionInput {
  conceptId: string | null;
  type: QuizQuestionType;
  prompt: string;
  explanation: string;
  correctAnswerText: string;
  options: QuizQuestionOptionInput[];
}

export interface QuizGenerationPayload {
  artifactVersion: number;
  provider: string;
  model: string;
  title: string;
  questions: QuizQuestionInput[];
}

export const validateQuizGenerationPayload = (
  payload: QuizGenerationPayload
): QuizGenerationPayload | null => {
  if (!Number.isInteger(payload.artifactVersion) || payload.artifactVersion < 1) {
    return null;
  }
  if (!payload.provider.trim() || !payload.model.trim() || !payload.title.trim()) {
    return null;
  }
  if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
    return null;
  }

  const validQuestions = payload.questions.every((question) => {
    if (!question.prompt.trim() || !question.explanation.trim() || !question.correctAnswerText.trim()) {
      return false;
    }

    if (question.type === "short_answer") {
      return question.options.length === 0;
    }

    if (question.options.length < 2) {
      return false;
    }

    const correctCount = question.options.filter((option) => option.isCorrect).length;
    return correctCount === 1 && question.options.every((option) => option.key.trim() && option.text.trim());
  });

  return validQuestions ? payload : null;
};

const buildMcqQuestion = (
  concept: QuizGenerationConceptInput,
  difficulty: DifficultyLevel
): QuizQuestionInput => ({
  conceptId: concept.id,
  type: "mcq",
  prompt: `Which option best describes the core focus of "${concept.title}"?`,
  explanation: `The correct answer centers on the key intent from the concept summary at ${difficulty} depth.`,
  correctAnswerText: concept.summary,
  options: [
    { key: "a", text: concept.summary, isCorrect: true },
    {
      key: "b",
      text: `A narrow implementation detail that ignores the main objective of ${concept.title}.`,
      isCorrect: false
    },
    {
      key: "c",
      text: "A definition focused only on tooling choices, not understanding outcomes.",
      isCorrect: false
    },
    {
      key: "d",
      text: "A checklist that skips conceptual reasoning and tradeoff analysis.",
      isCorrect: false
    }
  ]
});

const buildTrueFalseQuestion = (concept: QuizGenerationConceptInput): QuizQuestionInput => ({
  conceptId: concept.id,
  type: "true_false",
  prompt: `True or false: "${concept.title}" can be understood without considering tradeoffs or failure modes.`,
  explanation:
    "False is correct because robust understanding requires evaluating tradeoffs and failure paths.",
  correctAnswerText: "False",
  options: [
    { key: "true", text: "True", isCorrect: false },
    { key: "false", text: "False", isCorrect: true }
  ]
});

const buildShortAnswerQuestion = (concept: QuizGenerationConceptInput): QuizQuestionInput => ({
  conceptId: concept.id,
  type: "short_answer",
  prompt: `In one or two sentences, explain why "${concept.title}" matters in practice.`,
  explanation: "A strong response should connect the concept to practical outcomes and decision quality.",
  correctAnswerText: concept.summary,
  options: []
});

export const generateBootstrapQuizPayload = (
  topic: string,
  difficulty: DifficultyLevel,
  concepts: QuizGenerationConceptInput[]
): QuizGenerationPayload => {
  const selectedConcepts = concepts.slice(0, 6);
  const questions: QuizQuestionInput[] = [];

  selectedConcepts.forEach((concept, index) => {
    if (index % 3 === 0) {
      questions.push(buildMcqQuestion(concept, difficulty));
      return;
    }
    if (index % 3 === 1) {
      questions.push(buildTrueFalseQuestion(concept));
      return;
    }
    questions.push(buildShortAnswerQuestion(concept));
  });

  if (questions.length < 3) {
    selectedConcepts.forEach((concept) => {
      if (questions.length >= 3) {
        return;
      }
      questions.push(buildMcqQuestion(concept, difficulty));
    });
  }

  return {
    artifactVersion: 1,
    provider: "aetherforge-bootstrap",
    model: "phase3-template-v1",
    title: `${topic} mixed practice`,
    questions
  };
};
