import type { SagaPipelineContext } from "./middleware.js";

/**
 * Logger interface for saga bus.
 */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Metrics interface for saga bus.
 */
export interface Metrics {
  /**
   * Increment a counter.
   */
  increment(
    name: string,
    value?: number,
    tags?: Record<string, string>
  ): void;

  /**
   * Record a duration/timing.
   */
  recordDuration(
    name: string,
    ms: number,
    tags?: Record<string, string>
  ): void;

  /**
   * Set a gauge value.
   */
  gauge(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void;
}

/**
 * Tracer interface for distributed tracing.
 */
export interface Tracer {
  /**
   * Execute a function within a named span.
   */
  withSpan<T>(
    name: string,
    ctx: SagaPipelineContext,
    fn: () => Promise<T>
  ): Promise<T>;
}

/**
 * Error handler for determining retry behavior.
 */
export interface ErrorHandler {
  /**
   * Handle an error and determine the action.
   * @returns "retry" to retry, "dlq" to send to DLQ, "drop" to discard
   */
  handle(
    error: unknown,
    ctx: SagaPipelineContext
  ): Promise<"retry" | "dlq" | "drop">;
}
