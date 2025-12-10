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
