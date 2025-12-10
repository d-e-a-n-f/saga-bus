import type { MiddlewareHandler, ErrorHandler } from "hono";
import type { SagaBusEnv, SagaBusHonoOptions } from "./types.js";

// Simple UUID generator for edge compatibility (no crypto.randomUUID dependency)
function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Creates middleware that attaches the bus instance and correlation ID to context.
 */
export function sagaBusMiddleware(
  options: SagaBusHonoOptions
): MiddlewareHandler<SagaBusEnv> {
  const {
    bus,
    correlationIdHeader = "x-correlation-id",
    generateCorrelationId = true,
    correlationIdGenerator = generateId,
  } = options;

  return async (c, next) => {
    // Attach bus to context
    c.set("bus", bus);

    // Extract or generate correlation ID
    let correlationId = c.req.header(correlationIdHeader);

    if (!correlationId && generateCorrelationId) {
      correlationId = correlationIdGenerator();
    }

    if (correlationId) {
      c.set("correlationId", correlationId);
      c.header(correlationIdHeader, correlationId);
    }

    await next();
  };
}

/**
 * Error handler for saga-related errors.
 * Use with app.onError(sagaErrorHandler())
 */
export function sagaErrorHandler(): ErrorHandler<SagaBusEnv> {
  return (err, c) => {
    if (err instanceof Error) {
      if (err.name === "SagaTimeoutError") {
        return c.json(
          {
            error: "Saga Timeout",
            message: err.message,
            correlationId: c.get("correlationId"),
          },
          408
        );
      }

      if (err.name === "ConcurrencyError") {
        return c.json(
          {
            error: "Concurrency Conflict",
            message: err.message,
            correlationId: c.get("correlationId"),
          },
          409
        );
      }
    }

    // Return generic error for other cases
    return c.json(
      {
        error: "Internal Server Error",
        message: err instanceof Error ? err.message : "Unknown error",
        correlationId: c.get("correlationId"),
      },
      500
    );
  };
}
