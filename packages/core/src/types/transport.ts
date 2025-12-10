import type { BaseMessage, MessageEnvelope } from "./messages.js";

/**
 * Options for subscribing to messages on a transport.
 */
export interface TransportSubscribeOptions {
  /** The endpoint/topic/queue to subscribe to */
  readonly endpoint: string;
  /** Maximum concurrent message handlers (default: 1) */
  readonly concurrency?: number;
  /** Consumer group name for competing consumers */
  readonly group?: string;
}

/**
 * Options for publishing messages on a transport.
 */
export interface TransportPublishOptions {
  /** The endpoint/topic/exchange to publish to */
  readonly endpoint: string;
  /** Routing/partition key */
  readonly key?: string;
  /** Additional headers to include */
  readonly headers?: Record<string, string>;
  /** Delay delivery by this many milliseconds */
  readonly delayMs?: number;
}

/**
 * Transport interface for sending and receiving messages.
 * Implementations include in-memory, RabbitMQ, Kafka, etc.
 */
export interface Transport {
  /**
   * Start the transport (connect, initialize resources).
   */
  start(): Promise<void>;

  /**
   * Stop the transport (disconnect, cleanup).
   */
  stop(): Promise<void>;

  /**
   * Subscribe to messages on an endpoint.
   */
  subscribe<TMessage extends BaseMessage>(
    options: TransportSubscribeOptions,
    handler: (envelope: MessageEnvelope<TMessage>) => Promise<void>
  ): Promise<void>;

  /**
   * Publish a message to an endpoint.
   */
  publish<TMessage extends BaseMessage>(
    message: TMessage,
    options: TransportPublishOptions
  ): Promise<void>;
}
