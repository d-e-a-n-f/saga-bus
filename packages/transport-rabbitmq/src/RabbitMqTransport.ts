import { randomUUID } from "node:crypto";
import type { ConsumeMessage } from "amqplib";
import type {
  Transport,
  TransportSubscribeOptions,
  TransportPublishOptions,
  BaseMessage,
  MessageEnvelope,
} from "@saga-bus/core";
import type { RabbitMqTransportOptions, Subscription } from "./types.js";
import { ConnectionManager } from "./ConnectionManager.js";

/**
 * RabbitMQ transport implementation using amqplib.
 *
 * @example
 * ```typescript
 * const transport = new RabbitMqTransport({
 *   uri: "amqp://localhost:5672",
 *   exchange: "saga-bus",
 * });
 *
 * await transport.start();
 *
 * await transport.subscribe(
 *   { endpoint: "OrderSubmitted", concurrency: 5 },
 *   async (envelope) => { ... }
 * );
 *
 * await transport.publish(
 *   { type: "OrderSubmitted", orderId: "123" },
 *   { endpoint: "OrderSubmitted" }
 * );
 * ```
 */
export class RabbitMqTransport implements Transport {
  private readonly options: RabbitMqTransportOptions;
  private readonly connectionManager: ConnectionManager;
  private readonly subscriptions: Subscription[] = [];
  private readonly handlers = new Map<
    string,
    (envelope: MessageEnvelope) => Promise<void>
  >();
  private started = false;

  constructor(options: RabbitMqTransportOptions) {
    this.options = options;
    this.connectionManager = new ConnectionManager(options);

    // Re-establish subscriptions on reconnect
    this.connectionManager.onConnected(() => {
      if (this.started) {
        void this.resubscribeAll();
      }
    });
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    await this.connectionManager.connect();
    this.started = true;
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    // Cancel all consumers
    const channel = this.connectionManager.getChannel();
    for (const sub of this.subscriptions) {
      if (sub.consumerTag) {
        try {
          await channel.cancel(sub.consumerTag);
        } catch {
          // Ignore cancel errors
        }
      }
    }

    await this.connectionManager.close();
    this.started = false;
    this.subscriptions.length = 0;
    this.handlers.clear();
  }

  async subscribe<TMessage extends BaseMessage>(
    options: TransportSubscribeOptions,
    handler: (envelope: MessageEnvelope<TMessage>) => Promise<void>
  ): Promise<void> {
    const channel = this.connectionManager.getChannel();
    const { endpoint, concurrency = 1, group } = options;

    // Build queue name
    const queuePrefix = this.options.queuePrefix ?? "";
    const queueName = group
      ? `${queuePrefix}${endpoint}.${group}`
      : `${queuePrefix}${endpoint}`;

    // Assert queue
    await channel.assertQueue(queueName, {
      durable: this.options.durable ?? true,
    });

    // Bind queue to exchange with routing key = endpoint
    await channel.bindQueue(queueName, this.options.exchange, endpoint);

    // Set prefetch for concurrency control
    await channel.prefetch(concurrency);

    // Store handler
    this.handlers.set(
      queueName,
      handler as (envelope: MessageEnvelope) => Promise<void>
    );

    // Start consuming
    const { consumerTag } = await channel.consume(
      queueName,
      (msg) => {
        if (!msg) return;
        void this.handleMessage(queueName, msg);
      },
      { noAck: false }
    );

    // Track subscription
    this.subscriptions.push({
      endpoint,
      queueName,
      concurrency,
      consumerTag,
    });
  }

  async publish<TMessage extends BaseMessage>(
    message: TMessage,
    options: TransportPublishOptions
  ): Promise<void> {
    const channel = this.connectionManager.getChannel();
    const { endpoint, headers = {}, delayMs, key } = options;

    // Create envelope
    const envelope: MessageEnvelope<TMessage> = {
      id: randomUUID(),
      type: message.type,
      payload: message,
      headers: { ...headers },
      timestamp: new Date(),
      partitionKey: key,
    };

    // Serialize message
    const content = Buffer.from(JSON.stringify(envelope));

    // Build publish options
    const persistent = this.options.messageOptions?.persistent ?? true;
    const contentType =
      this.options.messageOptions?.contentType ?? "application/json";

    const publishOptions: {
      persistent: boolean;
      contentType: string;
      messageId: string;
      timestamp: number;
      headers: Record<string, unknown>;
    } = {
      persistent,
      contentType,
      messageId: envelope.id,
      timestamp: envelope.timestamp.getTime(),
      headers: {
        ...headers,
        "x-message-type": message.type,
      },
    };

    // Handle delayed messages using RabbitMQ delayed message plugin
    // or fall back to TTL + dead-letter pattern
    if (delayMs && delayMs > 0) {
      // Using x-delay header (requires rabbitmq_delayed_message_exchange plugin)
      // Alternative: use separate delay queues with TTL
      publishOptions.headers["x-delay"] = delayMs;
    }

    // Publish to exchange with routing key = endpoint
    channel.publish(
      this.options.exchange,
      endpoint,
      content,
      publishOptions
    );
  }

  /**
   * Handle an incoming message.
   */
  private async handleMessage(
    queueName: string,
    msg: ConsumeMessage
  ): Promise<void> {
    const channel = this.connectionManager.getChannel();
    const handler = this.handlers.get(queueName);

    if (!handler) {
      // No handler, nack without requeue
      channel.nack(msg, false, false);
      return;
    }

    try {
      // Parse envelope
      const parsed = JSON.parse(msg.content.toString()) as MessageEnvelope;

      // Ensure timestamp is a Date
      const envelope: MessageEnvelope = {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
      };

      // Execute handler
      await handler(envelope);

      // Acknowledge success
      channel.ack(msg);
    } catch (error) {
      console.error("[RabbitMQ] Message handler error:", error);

      // Nack with requeue for retry
      // The bus runtime will handle retry logic via republishing
      channel.nack(msg, false, false);

      // Re-throw for error handling
      throw error;
    }
  }

  /**
   * Re-establish all subscriptions after reconnection.
   */
  private async resubscribeAll(): Promise<void> {
    const channel = this.connectionManager.getChannel();

    for (const sub of this.subscriptions) {
      try {
        // Re-assert queue
        await channel.assertQueue(sub.queueName, {
          durable: this.options.durable ?? true,
        });

        // Re-bind queue
        await channel.bindQueue(
          sub.queueName,
          this.options.exchange,
          sub.endpoint
        );

        // Set prefetch
        await channel.prefetch(sub.concurrency);

        // Re-consume
        const handler = this.handlers.get(sub.queueName);
        if (handler) {
          const { consumerTag } = await channel.consume(
            sub.queueName,
            (msg) => {
              if (!msg) return;
              void this.handleMessage(sub.queueName, msg);
            },
            { noAck: false }
          );
          sub.consumerTag = consumerTag;
        }
      } catch (error) {
        console.error(
          `[RabbitMQ] Failed to resubscribe to ${sub.queueName}:`,
          error
        );
      }
    }
  }

  /**
   * Check if the transport is connected.
   */
  isConnected(): boolean {
    return this.connectionManager.isConnected();
  }

  /**
   * Get transport statistics.
   */
  getStats(): { subscriptionCount: number; isConnected: boolean } {
    return {
      subscriptionCount: this.subscriptions.length,
      isConnected: this.isConnected(),
    };
  }
}
