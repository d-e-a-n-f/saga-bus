import type { MessageEnvelope } from "@saga-bus/core";

/**
 * Store interface for tracking processed message IDs.
 */
export interface IdempotencyStore {
  /**
   * Check if a message ID has been processed.
   * @param messageId - The message ID to check
   * @returns true if the message was already processed
   */
  has(messageId: string): Promise<boolean>;

  /**
   * Mark a message ID as processed.
   * @param messageId - The message ID to mark
   * @param ttlMs - Time to live in milliseconds (optional)
   */
  set(messageId: string, ttlMs?: number): Promise<void>;

  /**
   * Remove a message ID from the store.
   * @param messageId - The message ID to remove
   */
  delete(messageId: string): Promise<void>;

  /**
   * Clear all entries (useful for testing).
   */
  clear(): Promise<void>;
}

/**
 * Function to extract message ID from an envelope.
 */
export type MessageIdExtractor = (envelope: MessageEnvelope) => string;

/**
 * Action to take when a duplicate message is detected.
 */
export type DuplicateAction = "skip" | "log" | "throw";

/**
 * Options for the idempotency middleware.
 */
export interface IdempotencyMiddlewareOptions {
  /**
   * Store for tracking processed message IDs.
   */
  store: IdempotencyStore;

  /**
   * Time window for deduplication in milliseconds.
   * Messages with the same ID within this window will be considered duplicates.
   * @default 60000 (1 minute)
   */
  windowMs?: number;

  /**
   * Function to extract the message ID from an envelope.
   * Defaults to using envelope.id.
   */
  getMessageId?: MessageIdExtractor;

  /**
   * Action to take when a duplicate is detected.
   * - "skip": Silently skip processing (default)
   * - "log": Skip but log a warning
   * - "throw": Throw a DuplicateMessageError
   * @default "skip"
   */
  onDuplicate?: DuplicateAction;

  /**
   * Custom logger for duplicate detection messages.
   */
  logger?: {
    warn(message: string, meta?: Record<string, unknown>): void;
  };

  /**
   * Message types to exclude from idempotency checks.
   * Useful for messages that are naturally idempotent or should always be processed.
   */
  excludeTypes?: string[];

  /**
   * Whether to mark message as processed before or after handler execution.
   * - "before": Mark before processing (at-most-once delivery)
   * - "after": Mark after processing (at-least-once delivery, default)
   * @default "after"
   */
  markTiming?: "before" | "after";
}

/**
 * Error thrown when a duplicate message is detected and onDuplicate is "throw".
 */
export class DuplicateMessageError extends Error {
  public readonly messageId: string;
  public readonly messageType: string;

  constructor(messageId: string, messageType: string) {
    super(`Duplicate message detected: ${messageId} (type: ${messageType})`);
    this.name = "DuplicateMessageError";
    this.messageId = messageId;
    this.messageType = messageType;
  }
}
