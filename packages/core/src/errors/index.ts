/**
 * Thrown when optimistic concurrency check fails.
 */
export class ConcurrencyError extends Error {
  readonly sagaId: string;
  readonly expectedVersion: number;
  readonly actualVersion?: number;

  constructor(
    sagaId: string,
    expectedVersion: number,
    actualVersion?: number
  ) {
    const message = actualVersion !== undefined
      ? `Concurrency conflict for saga ${sagaId}: expected version ${expectedVersion}, got ${actualVersion}`
      : `Concurrency conflict for saga ${sagaId}: expected version ${expectedVersion}`;

    super(message);
    this.name = "ConcurrencyError";
    this.sagaId = sagaId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

/**
 * Marker class for transient errors that should be retried.
 */
export class TransientError extends Error {
  override readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = "TransientError";
    this.cause = cause;
  }

  static wrap(error: Error): TransientError {
    return new TransientError(error.message, error);
  }
}

/**
 * Thrown when message validation fails.
 */
export class ValidationError extends Error {
  readonly field?: string;
  readonly value?: unknown;

  constructor(message: string, field?: string, value?: unknown) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    this.value = value;
  }
}

/**
 * Thrown when a saga timeout expires.
 * Can be used in handlers to detect timeout scenarios.
 */
export class SagaTimeoutError extends Error {
  readonly sagaId: string;
  readonly sagaName: string;
  readonly correlationId: string;
  readonly timeoutMs: number;

  constructor(
    sagaId: string,
    sagaName: string,
    correlationId: string,
    timeoutMs: number
  ) {
    super(
      `Saga timeout expired: ${sagaName} (${sagaId}) after ${timeoutMs}ms`
    );
    this.name = "SagaTimeoutError";
    this.sagaId = sagaId;
    this.sagaName = sagaName;
    this.correlationId = correlationId;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Context attached to processing errors for better observability.
 */
export interface SagaErrorContext {
  readonly sagaName: string;
  readonly correlationId: string;
  readonly sagaId?: string;
  readonly messageType: string;
  readonly messageId: string;
}

/**
 * Wraps errors that occur during saga processing with context.
 * Used by BusImpl to provide richer error context to error handlers.
 */
export class SagaProcessingError extends Error {
  readonly context: SagaErrorContext;
  override readonly cause: Error;

  constructor(cause: Error, context: SagaErrorContext) {
    super(`Error processing message in ${context.sagaName}: ${cause.message}`);
    this.name = "SagaProcessingError";
    this.cause = cause;
    this.context = context;
  }

  /**
   * Check if an error is a SagaProcessingError and extract context.
   */
  static extractContext(error: unknown): SagaErrorContext | null {
    if (error instanceof SagaProcessingError) {
      return error.context;
    }
    return null;
  }
}
