import { randomUUID } from "node:crypto";
import type {
  Kafka,
  Producer,
  Consumer,
  EachMessagePayload,
  Admin,
} from "kafkajs";
import type {
  Transport,
  TransportSubscribeOptions,
  TransportPublishOptions,
  BaseMessage,
  MessageEnvelope,
} from "@saga-bus/core";
import type { KafkaTransportOptions, KafkaSubscription } from "./types.js";

/**
 * Kafka transport for saga-bus using KafkaJS.
 *
 * Uses partition keys for message ordering within a saga.
 * Consumer groups enable horizontal scaling.
 *
 * @example
 * ```typescript
 * import { Kafka } from "kafkajs";
 *
 * const kafka = new Kafka({
 *   clientId: "my-app",
 *   brokers: ["localhost:9092"],
 * });
 *
 * const transport = new KafkaTransport({
 *   kafka,
 *   defaultTopic: "saga-bus.events",
 *   groupId: "order-processor",
 * });
 *
 * await transport.start();
 *
 * await transport.subscribe(
 *   { endpoint: "saga-bus.orders", concurrency: 5 },
 *   async (envelope) => { ... }
 * );
 *
 * await transport.publish(
 *   { type: "OrderSubmitted", orderId: "123" },
 *   { endpoint: "saga-bus.orders", key: "order-123" }
 * );
 * ```
 */
export class KafkaTransport implements Transport {
  private readonly kafka: Kafka;
  private readonly defaultTopic: string | undefined;
  private readonly groupId: string | undefined;
  private readonly createTopics: boolean;
  private readonly numPartitions: number;
  private readonly replicationFactor: number;
  private readonly fromBeginning: boolean;
  private readonly sessionTimeout: number;
  private readonly heartbeatInterval: number;

  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private readonly handlers = new Map<
    string,
    (envelope: MessageEnvelope) => Promise<void>
  >();
  private readonly subscriptions: KafkaSubscription[] = [];
  private isRunning = false;

  constructor(options: KafkaTransportOptions) {
    this.kafka = options.kafka;
    this.defaultTopic = options.defaultTopic;
    this.groupId = options.groupId;
    this.createTopics = options.createTopics ?? false;
    this.numPartitions = options.numPartitions ?? 3;
    this.replicationFactor = options.replicationFactor ?? 1;
    this.fromBeginning = options.fromBeginning ?? false;
    this.sessionTimeout = options.sessionTimeout ?? 30000;
    this.heartbeatInterval = options.heartbeatInterval ?? 3000;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    // Connect producer
    this.producer = this.kafka.producer();
    await this.producer.connect();

    // If we have subscriptions, start consumer
    if (this.subscriptions.length > 0) {
      if (!this.groupId) {
        throw new Error("groupId is required for consuming");
      }

      // Create topics if needed
      if (this.createTopics) {
        await this.ensureTopics();
      }

      // Create and connect consumer
      this.consumer = this.kafka.consumer({
        groupId: this.groupId,
        sessionTimeout: this.sessionTimeout,
        heartbeatInterval: this.heartbeatInterval,
      });

      await this.consumer.connect();

      // Subscribe to all topics
      for (const sub of this.subscriptions) {
        await this.consumer.subscribe({
          topic: sub.topic,
          fromBeginning: this.fromBeginning,
        });
      }

      this.isRunning = true;

      // Start consuming with manual commit
      await this.consumer.run({
        autoCommit: false,
        eachMessage: async (payload: EachMessagePayload) => {
          await this.processMessage(payload);
        },
      });
    } else {
      this.isRunning = true;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.consumer) {
      await this.consumer.disconnect();
      this.consumer = null;
    }

    if (this.producer) {
      await this.producer.disconnect();
      this.producer = null;
    }
  }

  async subscribe<TMessage extends BaseMessage>(
    options: TransportSubscribeOptions,
    handler: (envelope: MessageEnvelope<TMessage>) => Promise<void>
  ): Promise<void> {
    const topic = options.endpoint;

    if (!topic) {
      throw new Error("endpoint (topic) is required for subscribing");
    }

    if (!this.groupId) {
      throw new Error("groupId is required for subscribing");
    }

    // Store handler
    this.handlers.set(
      topic,
      handler as (envelope: MessageEnvelope) => Promise<void>
    );

    this.subscriptions.push({
      topic,
      concurrency: options.concurrency ?? 1,
    });
  }

  async publish<TMessage extends BaseMessage>(
    message: TMessage,
    options: TransportPublishOptions
  ): Promise<void> {
    const topic = options.endpoint || this.defaultTopic;

    if (!topic) {
      throw new Error("endpoint (topic) is required for publishing");
    }

    // Lazily connect producer if not started
    if (!this.producer) {
      this.producer = this.kafka.producer();
      await this.producer.connect();
    }

    const { key, headers = {} } = options;

    // Create envelope
    const envelope: MessageEnvelope<TMessage> = {
      id: randomUUID(),
      type: message.type,
      payload: message,
      headers: {
        ...headers,
        "x-message-type": message.type,
      },
      timestamp: new Date(),
      partitionKey: key,
    };

    // Partition key for ordering
    const partitionKey = key ?? envelope.id;

    // Convert headers to Kafka format (Buffer values)
    const kafkaHeaders: Record<string, string> = {
      messageId: envelope.id,
      messageType: envelope.type,
      ...headers,
    };

    await this.producer.send({
      topic,
      messages: [
        {
          key: partitionKey,
          value: JSON.stringify(envelope),
          headers: kafkaHeaders,
        },
      ],
    });
  }

  private async ensureTopics(): Promise<void> {
    const admin: Admin = this.kafka.admin();
    await admin.connect();

    try {
      const existingTopics = await admin.listTopics();
      const topicsToCreate = this.subscriptions
        .map((s) => s.topic)
        .filter((topic) => !existingTopics.includes(topic));

      if (topicsToCreate.length > 0) {
        await admin.createTopics({
          topics: topicsToCreate.map((topic) => ({
            topic,
            numPartitions: this.numPartitions,
            replicationFactor: this.replicationFactor,
          })),
        });
      }
    } finally {
      await admin.disconnect();
    }
  }

  private async processMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    if (!message.value) {
      return;
    }

    try {
      // Parse envelope
      const parsed = JSON.parse(message.value.toString()) as MessageEnvelope;

      // Reconstruct Date objects
      const envelope: MessageEnvelope = {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
      };

      // Find handler for this topic
      const handler = this.handlers.get(topic);

      if (handler) {
        await handler(envelope);
      }

      // Commit offset on success
      await this.consumer!.commitOffsets([
        {
          topic,
          partition,
          offset: (BigInt(message.offset) + 1n).toString(),
        },
      ]);
    } catch (error) {
      console.error("[Kafka] Message processing error:", error);
      // Don't commit - message will be redelivered
      throw error;
    }
  }

  /**
   * Check if the transport is running.
   */
  isStarted(): boolean {
    return this.isRunning;
  }

  /**
   * Get transport statistics.
   */
  getStats(): { subscriptionCount: number; isRunning: boolean } {
    return {
      subscriptionCount: this.subscriptions.length,
      isRunning: this.isRunning,
    };
  }
}
