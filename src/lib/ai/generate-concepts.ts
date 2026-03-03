import type { DifficultyLevel } from "@/lib/contracts/domain";
import type { AiProviderSession } from "@/lib/ai/provider-session";
import { logger, recordError } from "@/lib/observability";

import {
  type GenerationPayload,
  type ConceptNodeInput,
  generateBootstrapConceptPayload,
  validateGenerationPayload
} from "./concepts";
import { runChatGptWebPrompt } from "./browser/chatgpt-web";
import { withRetries } from "./retry";

const browserAutomationEnabled = () => process.env.AI_BROWSER_AUTOMATION === "1";
export type AiGenerationPath = "browser_driver" | "fallback";

const buildBrowserPrompt = (topic: string, difficulty: DifficultyLevel) =>
  [
    "Return JSON only.",
    "Shape:",
    '{ "nodes": [{ "title": "string", "summary": "string", "examples": [{ "type":"example|case_study", "title":"string", "body":"string" }] }] }',
    "Rules:",
    "- 2-5 nodes",
    '- example.type must be "example" or "case_study"',
    "- at least two examples per node",
    `Topic: ${topic}`,
    `Difficulty: ${difficulty}`
  ].join("\n");

const parseNodesFromModel = (content: string): ConceptNodeInput[] | null => {
  try {
    const parsed = JSON.parse(content) as { nodes?: ConceptNodeInput[] };
    return Array.isArray(parsed.nodes) ? parsed.nodes : null;
  } catch {
    return null;
  }
};

async function generateViaBrowserDriver(
  topic: string,
  difficulty: DifficultyLevel,
  session: AiProviderSession
): Promise<GenerationPayload> {
  if (session.providerKey !== "chatgpt-web") {
    throw new Error(`Browser driver not yet implemented for provider: ${session.providerKey}`);
  }
  const rawJson = await runChatGptWebPrompt(session.userId, buildBrowserPrompt(topic, difficulty));
  const nodes = parseNodesFromModel(rawJson);
  if (!nodes) {
    throw new Error("Browser provider response could not be parsed as concept JSON.");
  }
  const payload: GenerationPayload = {
    artifactVersion: 1,
    provider: session.providerKey,
    model: session.modelHint ?? "chatgpt-web-ui",
    nodes
  };
  const validated = validateGenerationPayload(payload);
  if (!validated) {
    throw new Error("Browser provider response failed concept schema validation.");
  }
  return validated;
}

export async function generateConceptPayload(
  topic: string,
  difficulty: DifficultyLevel,
  session: AiProviderSession
): Promise<{ payload: GenerationPayload; generationPath: AiGenerationPath }> {
  if (browserAutomationEnabled()) {
    try {
      const payload = await withRetries(
        () => generateViaBrowserDriver(topic, difficulty, session),
        { operationName: "concept_generation_browser_ui", maxAttempts: 2, delayMs: 500 }
      );
      return { payload, generationPath: "browser_driver" };
    } catch (error) {
      recordError("concept_generation_browser_ui", error, {
        providerKey: session.providerKey,
        mode: session.mode
      });
      logger.warn("Browser automation concept generation failed; using fallback payload", {
        providerKey: session.providerKey
      });
    }
  }

  const fallback = generateBootstrapConceptPayload(topic, difficulty);
  return {
    payload: {
      ...fallback,
      provider: session.providerKey,
      model: session.modelHint ?? `${session.mode}-manual`
    },
    generationPath: "fallback"
  };
}
