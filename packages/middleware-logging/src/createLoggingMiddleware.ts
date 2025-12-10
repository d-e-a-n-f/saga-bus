import type { SagaMiddleware, SagaPipelineContext, Logger } from "@saga-bus/core";
import type { LoggingMiddlewareOptions, LogLevel, LogEventType } from "./types.js";

/**
 * Log level priorities for filtering.
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Default console-based logger.
 */
const defaultLogger: Logger = {
  debug: (message, meta) => console.debug(`[saga-bus] ${message}`, meta ?? ""),
  info: (message, meta) => console.info(`[saga-bus] ${message}`, meta ?? ""),
  warn: (message, meta) => console.warn(`[saga-bus] ${message}`, meta ?? ""),
  error: (message, meta) => console.error(`[saga-bus] ${message}`, meta ?? ""),
};

/**
 * Create a logging middleware for saga execution.
 *
 * @example
 * ```typescript
 * const loggingMiddleware = createLoggingMiddleware({
 *   level: "debug",
 *   logPayload: true,
 * });
 *
 * const bus = createBus({
 *   transport,
 *   sagas: [...],
 *   middleware: [loggingMiddleware],
 * });
 * ```
 */
export function createLoggingMiddleware(
  options: LoggingMiddlewareOptions = {}
): SagaMiddleware {
  const {
    logger = defaultLogger,
    level = "info",
    logPayload = false,
    logState = false,
    filter,
    enrichMeta,
  } = options;

  const minPriority = LOG_LEVEL_PRIORITY[level];

  /**
   * Log an event if it meets the level threshold.
   */
  function log(
    eventLevel: LogLevel,
    eventType: LogEventType,
    message: string,
    meta: Record<string, unknown>
  ): void {
    if (LOG_LEVEL_PRIORITY[eventLevel] < minPriority) {
      return;
    }

    if (filter && !filter(eventType, meta)) {
      return;
    }

    const enrichedMeta = enrichMeta ? enrichMeta(meta) : meta;
    const finalMeta = { ...enrichedMeta, event: eventType };

    switch (eventLevel) {
      case "debug":
        logger.debug(message, finalMeta);
        break;
      case "info":
        logger.info(message, finalMeta);
        break;
      case "warn":
        logger.warn(message, finalMeta);
        break;
      case "error":
        logger.error(message, finalMeta);
        break;
    }
  }

  /**
   * Build base metadata from pipeline context.
   */
  function baseMeta(ctx: SagaPipelineContext): Record<string, unknown> {
    const meta: Record<string, unknown> = {
      sagaName: ctx.sagaName,
      correlationId: ctx.correlationId,
      messageId: ctx.envelope.id,
      messageType: ctx.envelope.type,
    };

    if (ctx.sagaId) {
      meta.sagaId = ctx.sagaId;
    }

    if (logPayload) {
      meta.payload = ctx.envelope.payload;
    }

    return meta;
  }

  return async (ctx: SagaPipelineContext, next: () => Promise<void>) => {
    const startTime = Date.now();

    // Log message received
    log("debug", "saga.message.received", "Message received", {
      ...baseMeta(ctx),
      headers: ctx.envelope.headers,
    });

    // Log handler start
    log("debug", "saga.handler.start", "Handler starting", baseMeta(ctx));

    try {
      await next();

      const duration = Date.now() - startTime;

      // Determine what happened
      const isNew = ctx.preState === undefined && ctx.postState !== undefined;
      const isCompleted = ctx.postState?.metadata?.isCompleted === true;
      const wasAlreadyCompleted = ctx.preState?.metadata?.isCompleted === true;

      // Build result metadata
      const resultMeta: Record<string, unknown> = {
        ...baseMeta(ctx),
        durationMs: duration,
      };

      if (ctx.sagaId) {
        resultMeta.sagaId = ctx.sagaId;
      }

      if (logState && ctx.postState) {
        resultMeta.state = ctx.postState;
      }

      if (ctx.postState) {
        resultMeta.version = ctx.postState.metadata.version;
      }

      // Log appropriate event
      if (isNew) {
        log("info", "saga.state.created", "Saga instance created", resultMeta);
      } else if (isCompleted && !wasAlreadyCompleted) {
        log("info", "saga.state.completed", "Saga completed", resultMeta);
      } else if (ctx.postState) {
        log("debug", "saga.state.updated", "Saga state updated", resultMeta);
      }

      // Log handler success
      log("debug", "saga.handler.success", "Handler completed successfully", {
        ...baseMeta(ctx),
        durationMs: duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log handler error
      log("error", "saga.handler.error", "Handler failed", {
        ...baseMeta(ctx),
        durationMs: duration,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.name : "UnknownError",
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Re-throw to let error handling proceed
      throw error;
    }
  };
}
