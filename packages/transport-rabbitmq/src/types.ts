/**
 * RabbitMQ transport configuration options.
 */
export interface RabbitMqTransportOptions {
  /**
   * AMQP connection URI.
   * @example "amqp://guest:guest@localhost:5672"
   */
  uri: string;

  /**
   * Exchange name for publishing messages.
   */
  exchange: string;

  /**
   * Exchange type. Default: "topic"
   */
  exchangeType?: "topic" | "direct" | "fanout";

  /**
   * Whether the exchange should be durable. Default: true
   */
  durable?: boolean;

  /**
   * Prefix for queue names. Default: ""
   */
  queuePrefix?: string;

  /**
   * Reconnection options.
   */
  reconnect?: {
    /** Maximum reconnection attempts. Default: 10 */
    maxAttempts?: number;
    /** Initial delay between reconnection attempts in ms. Default: 1000 */
    initialDelayMs?: number;
    /** Maximum delay between reconnection attempts in ms. Default: 30000 */
    maxDelayMs?: number;
  };

  /**
   * Message serialization options.
   */
  messageOptions?: {
    /** Whether messages should be persistent. Default: true */
    persistent?: boolean;
    /** Content type header. Default: "application/json" */
    contentType?: string;
  };
}

/**
 * Internal subscription state.
 */
export interface Subscription {
  endpoint: string;
  queueName: string;
  concurrency: number;
  consumerTag?: string;
}
