import type { Logger } from "@saga-bus/core";

/**
 * Log level for filtering.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Log event types emitted by the middleware.
 */
export type LogEventType =
  | "saga.message.received"
  | "saga.handler.start"
  | "saga.handler.success"
  | "saga.handler.error"
  | "saga.state.created"
  | "saga.state.updated"
  | "saga.state.completed";

/**
 * Options for the logging middleware.
 */
export interface LoggingMiddlewareOptions {
  /**
   * Logger instance to use. Defaults to console-based logger.
   */
  logger?: Logger;

  /**
   * Minimum log level. Events below this level are not logged.
   * Default: "info"
   */
  level?: LogLevel;

  /**
   * Whether to log message payload. Default: false (for security/privacy).
   */
  logPayload?: boolean;

  /**
   * Whether to log full state. Default: false (can be large).
   */
  logState?: boolean;

  /**
   * Custom event filter. Return false to skip logging an event.
   */
  filter?: (eventType: LogEventType, meta: Record<string, unknown>) => boolean;

  /**
   * Custom metadata enricher. Add extra fields to all log events.
   */
  enrichMeta?: (meta: Record<string, unknown>) => Record<string, unknown>;
}
