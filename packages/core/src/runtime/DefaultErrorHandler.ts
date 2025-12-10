import type { ErrorHandler, SagaPipelineContext } from "../types/index.js";
import { ConcurrencyError, TransientError } from "../errors/index.js";

/**
 * List of error types that are considered transient and should be retried.
 */
const TRANSIENT_ERROR_PATTERNS = [
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /timeout/i,
  /connection.*refused/i,
  /connection.*reset/i,
  /network/i,
  /socket hang up/i,
  /EPIPE/i,
  /EHOSTUNREACH/i,
];

/**
 * Check if an error is transient based on its message.
 */
function isTransientError(error: unknown): boolean {
  // Explicit TransientError
  if (error instanceof TransientError) {
    return true;
  }

  // ConcurrencyError is transient (optimistic locking failure)
  if (error instanceof ConcurrencyError) {
    return true;
  }

  // Check error message against patterns
  if (error instanceof Error) {
    const message = error.message;
    return TRANSIENT_ERROR_PATTERNS.some((pattern) => pattern.test(message));
  }

  return false;
}

/**
 * Default error handler implementation.
 * Classifies errors as transient (retry) or permanent (DLQ).
 */
export class DefaultErrorHandler implements ErrorHandler {
  async handle(
    error: unknown,
    _ctx: SagaPipelineContext
  ): Promise<"retry" | "dlq" | "drop"> {
    // Transient errors should be retried
    if (isTransientError(error)) {
      return "retry";
    }

    // Permanent errors go to DLQ
    return "dlq";
  }
}

/**
 * Create a custom error handler with additional transient patterns.
 */
export function createErrorHandler(options?: {
  additionalTransientPatterns?: RegExp[];
  customClassifier?: (error: unknown, ctx: SagaPipelineContext) => "retry" | "dlq" | "drop" | null;
}): ErrorHandler {
  const additionalPatterns = options?.additionalTransientPatterns ?? [];
  const customClassifier = options?.customClassifier;

  return {
    async handle(error: unknown, ctx: SagaPipelineContext) {
      // Try custom classifier first
      if (customClassifier) {
        const result = customClassifier(error, ctx);
        if (result !== null) {
          return result;
        }
      }

      // Check standard transient errors
      if (isTransientError(error)) {
        return "retry";
      }

      // Check additional patterns
      if (error instanceof Error) {
        const message = error.message;
        if (additionalPatterns.some((pattern) => pattern.test(message))) {
          return "retry";
        }
      }

      return "dlq";
    },
  };
}
