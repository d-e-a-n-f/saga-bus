import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from "express";
import { randomUUID } from "crypto";
import type { SagaBusExpressOptions } from "./types.js";

/**
 * Creates middleware that attaches the bus instance to requests.
 */
export function sagaBusMiddleware(options: SagaBusExpressOptions): RequestHandler {
  const {
    bus,
    correlationIdHeader = "x-correlation-id",
    generateCorrelationId = true,
    correlationIdGenerator = randomUUID,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Attach bus to request
    req.bus = bus;

    // Extract or generate correlation ID
    let correlationId = req.headers[correlationIdHeader.toLowerCase()] as string | undefined;

    if (!correlationId && generateCorrelationId) {
      correlationId = correlationIdGenerator();
    }

    if (correlationId) {
      req.correlationId = correlationId;
      // Also set on response for tracing
      res.setHeader(correlationIdHeader, correlationId);
    }

    next();
  };
}

/**
 * Error handler middleware for saga-related errors.
 */
export function sagaErrorHandler(): ErrorRequestHandler {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    // Check if it's a saga-related error
    if (err.name === "SagaTimeoutError") {
      res.status(408).json({
        error: "Saga Timeout",
        message: err.message,
        correlationId: req.correlationId,
      });
      return;
    }

    if (err.name === "ConcurrencyError") {
      res.status(409).json({
        error: "Concurrency Conflict",
        message: err.message,
        correlationId: req.correlationId,
      });
      return;
    }

    // Pass to default error handler
    next(err);
  };
}
