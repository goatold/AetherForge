/**
 * Structured logging for AetherForge.
 * Replace with a provider (e.g. Datadog, Pino) by implementing the same interface.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: string | number | boolean | null | undefined;
}

const noop = () => {};

function shouldEmit(level: LogLevel, minLevel: LogLevel): boolean {
  const order: LogLevel[] = ["debug", "info", "warn", "error"];
  return order.indexOf(level) >= order.indexOf(minLevel);
}

function getMinLevel(): LogLevel {
  const v = process.env.LOG_LEVEL?.toLowerCase();
  if (v === "debug" || v === "info" || v === "warn" || v === "error") {
    return v;
  }
  return process.env.NODE_ENV === "development" ? "debug" : "info";
}

const minLevel = getMinLevel();

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const ctx = context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${ctx}`;
}

export const logger = {
  debug: (message: string, context?: LogContext) =>
    shouldEmit("debug", minLevel) ? console.debug(formatMessage("debug", message, context)) : noop,
  info: (message: string, context?: LogContext) =>
    shouldEmit("info", minLevel) ? console.info(formatMessage("info", message, context)) : noop,
  warn: (message: string, context?: LogContext) =>
    shouldEmit("warn", minLevel) ? console.warn(formatMessage("warn", message, context)) : noop,
  error: (message: string, context?: LogContext) =>
    shouldEmit("error", minLevel) ? console.error(formatMessage("error", message, context)) : noop
};
