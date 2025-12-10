import type { MessageEnvelope, BaseMessage } from "@saga-bus/core";

/**
 * Result of a validation.
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Validation errors if invalid */
  errors?: ValidationError[];
}

/**
 * A single validation error.
 */
export interface ValidationError {
  /** Path to the invalid field (e.g., "payload.items[0].quantity") */
  path: string;
  /** Error message */
  message: string;
  /** The invalid value */
  value?: unknown;
}

/**
 * A synchronous validator function that validates a message.
 */
export type SyncMessageValidator<T extends BaseMessage = BaseMessage> = (
  message: T
) => ValidationResult;

/**
 * An asynchronous validator function that validates a message.
 */
export type AsyncMessageValidator<T extends BaseMessage = BaseMessage> = (
  message: T
) => Promise<ValidationResult>;

/**
 * A validator function that validates a message (sync or async).
 */
export type MessageValidator<T extends BaseMessage = BaseMessage> = (
  message: T
) => ValidationResult | Promise<ValidationResult>;

/**
 * Action to take when validation fails.
 */
export type InvalidMessageAction = "skip" | "log" | "throw" | "dlq";

/**
 * Dead-letter queue handler for invalid messages.
 */
export type DeadLetterHandler = (
  envelope: MessageEnvelope,
  errors: ValidationError[]
) => Promise<void>;

/**
 * A validator that can be used in the middleware (accepts any message type).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyMessageValidator = (message: any) => ValidationResult | Promise<ValidationResult>;

/**
 * Options for the validation middleware.
 */
export interface ValidationMiddlewareOptions {
  /**
   * Map of message type to validator.
   * Messages without a registered validator will pass through.
   */
  validators: Record<string, AnyMessageValidator>;

  /**
   * Action to take when validation fails.
   * - "skip": Silently skip processing
   * - "log": Log warning and skip
   * - "throw": Throw a ValidationError
   * - "dlq": Send to dead-letter queue handler
   * @default "throw"
   */
  onInvalid?: InvalidMessageAction;

  /**
   * Handler for dead-letter queue (required if onInvalid is "dlq").
   */
  deadLetterHandler?: DeadLetterHandler;

  /**
   * Custom logger for validation errors.
   */
  logger?: {
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
  };

  /**
   * Whether to validate messages that don't have a registered validator.
   * If true, messages without validators will be rejected.
   * @default false
   */
  strictMode?: boolean;

  /**
   * Message types that should not be validated.
   */
  excludeTypes?: string[];
}

/**
 * Error thrown when validation fails and onInvalid is "throw".
 */
export class MessageValidationError extends Error {
  public readonly messageId: string;
  public readonly messageType: string;
  public readonly validationErrors: ValidationError[];

  constructor(
    messageId: string,
    messageType: string,
    errors: ValidationError[]
  ) {
    const errorSummary = errors
      .map((e) => `${e.path}: ${e.message}`)
      .join(", ");
    super(`Validation failed for message ${messageId}: ${errorSummary}`);
    this.name = "MessageValidationError";
    this.messageId = messageId;
    this.messageType = messageType;
    this.validationErrors = errors;
  }
}
