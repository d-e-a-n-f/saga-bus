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
