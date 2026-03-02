/**
 * Retry helper for AI provider calls. Used to tolerate transient failures.
 * Phase 7: Retries/fallbacks for AI provider failures.
 */

import { logger, recordError, startTimer } from "@/lib/observability";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  operationName?: string;
}

/**
 * Runs an async function with retries. On transient errors (network, 5xx),
 * waits delayMs then retries. Backoff is delayMs * (backoffMultiplier ** attempt).
 * Records errors and timing via observability.
 */
export async function withRetries<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    delayMs = DEFAULT_DELAY_MS,
    backoffMultiplier = 1.5,
    operationName = "ai_call"
  } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const done = startTimer(`${operationName}_attempt`, { attempt });
    try {
      const result = await fn();
      done();
      return result;
    } catch (error) {
      done();
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`AI provider attempt ${attempt}/${maxAttempts} failed`, {
        operation: operationName,
        attempt,
        error: message
      });
      if (attempt === maxAttempts) {
        recordError(operationName, error, { attempt: maxAttempts });
        throw error;
      }
      const wait = delayMs * Math.pow(backoffMultiplier, attempt - 1);
      await sleep(wait);
    }
  }
  throw lastError;
}
