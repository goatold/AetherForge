import { runChatGptWebPrompt } from "./chatgpt-web";
import { runClaudeWebPrompt } from "./claude-web";
import { runGeminiWebPrompt } from "./gemini-web";

type BrowserProviderKey = "chatgpt-web" | "claude-web" | "gemini-web";
type PromptShape = "concepts" | "quiz";

const isDryRun = () => process.env.AI_BROWSER_AUTOMATION_DRY_RUN === "1";

const detectPromptShape = (prompt: string): PromptShape =>
  prompt.includes('"questions"') ? "quiz" : "concepts";

const buildDryRunConceptJson = (providerKey: BrowserProviderKey) =>
  JSON.stringify({
    nodes: [
      {
        title: `${providerKey} concept mental model`,
        summary: `Deterministic dry-run concept payload for ${providerKey}.`,
        examples: [
          {
            type: "example",
            title: "Dry-run example",
            body: `Validate browser driver contract coverage for ${providerKey}.`
          },
          {
            type: "case_study",
            title: "Dry-run case study",
            body: `Confirm provider-attributed generation path behavior for ${providerKey}.`
          }
        ]
      },
      {
        title: `${providerKey} reliability checks`,
        summary: `Deterministic fallback-vs-driver split validation for ${providerKey}.`,
        examples: [
          {
            type: "example",
            title: "Path split example",
            body: "Inspect generationPath reporting in concept and quiz routes."
          },
          {
            type: "case_study",
            title: "Provider attribution case study",
            body: "Ensure payload provider attribution matches active session provider."
          }
        ]
      }
    ]
  });

const buildDryRunQuizJson = (providerKey: BrowserProviderKey) =>
  JSON.stringify({
    title: `${providerKey} dry-run quiz`,
    questions: [
      {
        conceptId: null,
        type: "mcq",
        prompt: `Which provider is under dry-run contract validation? (${providerKey})`,
        explanation: "The correct choice is the currently connected provider.",
        correctAnswerText: providerKey,
        options: [
          { key: "a", text: providerKey, isCorrect: true },
          { key: "b", text: "fallback-provider", isCorrect: false },
          { key: "c", text: "unknown-provider", isCorrect: false }
        ]
      },
      {
        conceptId: null,
        type: "true_false",
        prompt: "True or false: generationPath should report browser_driver in dry-run mode.",
        explanation: "True is correct for deterministic browser-driver matrix validation.",
        correctAnswerText: "True",
        options: [
          { key: "true", text: "True", isCorrect: true },
          { key: "false", text: "False", isCorrect: false }
        ]
      },
      {
        conceptId: null,
        type: "short_answer",
        prompt: "State one reason deterministic driver smokes reduce release risk.",
        explanation: "Deterministic outputs remove flaky provider/network dependencies during contract checks.",
        correctAnswerText: "Deterministic runs reduce flakiness and isolate contract behavior.",
        options: []
      }
    ]
  });

const runDryRunPrompt = (providerKey: BrowserProviderKey, prompt: string): string => {
  const shape = detectPromptShape(prompt);
  return shape === "quiz" ? buildDryRunQuizJson(providerKey) : buildDryRunConceptJson(providerKey);
};

export async function runBrowserProviderPrompt(
  providerKey: BrowserProviderKey,
  userId: string,
  prompt: string
): Promise<string> {
  if (isDryRun()) {
    return runDryRunPrompt(providerKey, prompt);
  }

  switch (providerKey) {
    case "chatgpt-web":
      return runChatGptWebPrompt(userId, prompt);
    case "claude-web":
      return runClaudeWebPrompt(userId, prompt);
    case "gemini-web":
      return runGeminiWebPrompt(userId, prompt);
    default:
      throw new Error(`Browser driver not yet implemented for provider: ${providerKey}`);
  }
}
