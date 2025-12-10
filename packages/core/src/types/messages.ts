/**
 * Base interface for all messages in the saga bus.
 * Every message must have a `type` discriminator.
 */
export interface BaseMessage {
  readonly type: string;
}

/**
 * Envelope wrapping a message with metadata for transport.
 */
export interface MessageEnvelope<T extends BaseMessage = BaseMessage> {
  /** Unique identifier for this message instance */
  readonly id: string;
  /** Message type discriminator (mirrors payload.type) */
  readonly type: T["type"];
  /** The actual message payload */
  readonly payload: T;
  /** Transport and application headers */
  readonly headers: Readonly<Record<string, string>>;
  /** When the message was created */
  readonly timestamp: Date;
  /** Optional partition key for ordered delivery */
  readonly partitionKey?: string;
}

/**
 * System message type for saga timeout expiration.
 * Automatically published when a saga's timeout expires.
 */
export interface SagaTimeoutExpired extends BaseMessage {
  readonly type: "SagaTimeoutExpired";
  /** ID of the saga that timed out */
  readonly sagaId: string;
  /** Name of the saga that timed out */
  readonly sagaName: string;
  /** Correlation ID of the saga */
  readonly correlationId: string;
  /** The timeout duration that was configured (in ms) */
  readonly timeoutMs: number;
  /** When the timeout was originally set */
  readonly timeoutSetAt: Date;
}

/** Well-known message type constant for saga timeout */
export const SAGA_TIMEOUT_MESSAGE_TYPE = "SagaTimeoutExpired" as const;
