/**
 * Observability integration points: logging, metrics, tracing.
 * See docs/plan.md Phase 7 and docs/reliability-runbook.md.
 */

export { logger } from "./logger";
export type { LogLevel, LogContext } from "./logger";
export {
  incrementCounter,
  recordTiming,
  startTimer,
  recordError,
  traceSpan,
  setTraceSpan
} from "./metrics";
export type { MetricTags, TraceSpanFn } from "./metrics";
