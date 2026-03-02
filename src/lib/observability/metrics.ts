/**
 * Metrics and tracing integration points for AetherForge.
 * Plug in a provider (e.g. Datadog, OpenTelemetry) by implementing these hooks.
 * No-op by default so the app runs without external observability.
 */

export interface MetricTags {
  [key: string]: string | number | boolean;
}

/** Increment a counter. Name should be snake_case (e.g. "ai_generation_total"). */
export function incrementCounter(name: string, value = 1, tags?: MetricTags): void {
  if (process.env.NODE_ENV === "development" && process.env.DEBUG_METRICS === "1") {
    console.debug(`[metrics] counter ${name} +${value}`, tags ?? {});
  }
}

/** Record a duration in milliseconds. */
export function recordTiming(name: string, durationMs: number, tags?: MetricTags): void {
  if (process.env.NODE_ENV === "development" && process.env.DEBUG_METRICS === "1") {
    console.debug(`[metrics] timing ${name} ${durationMs}ms`, tags ?? {});
  }
}

/** Start a timer; call the returned function to record the duration. */
export function startTimer(name: string, tags?: MetricTags): () => void {
  const start = Date.now();
  return () => {
    recordTiming(name, Date.now() - start, tags);
  };
}

/** Record an error for monitoring (e.g. schema failure, AI provider error). */
export function recordError(name: string, error: unknown, tags?: MetricTags): void {
  incrementCounter(`${name}_errors`, 1, tags);
  if (process.env.NODE_ENV === "development" && process.env.DEBUG_METRICS === "1") {
    console.debug(`[metrics] error ${name}`, error, tags ?? {});
  }
}

/** Span/trace hook: no-op by default. Set traceSpan in index to wrap critical paths. */
export type TraceSpanFn = <T>(name: string, fn: () => Promise<T>, tags?: MetricTags) => Promise<T>;

let traceSpanImpl: TraceSpanFn = async (name, fn) => {
  const done = startTimer(name);
  try {
    return await fn();
  } finally {
    done();
  }
};

export function setTraceSpan(fn: TraceSpanFn): void {
  traceSpanImpl = fn;
}

export function traceSpan<T>(name: string, fn: () => Promise<T>, tags?: MetricTags): Promise<T> {
  return traceSpanImpl(name, fn, tags);
}
