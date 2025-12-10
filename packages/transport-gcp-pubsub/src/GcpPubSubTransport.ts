import { PubSub, Topic, Subscription, Message } from "@google-cloud/pubsub";
import type {
  Transport,
  TransportSubscribeOptions,
  TransportPublishOptions,
  MessageEnvelope,
  BaseMessage,
} from "@saga-bus/core";
import type { GcpPubSubTransportOptions } from "./types.js";
import { randomUUID } from "crypto";

/**
 * GCP Pub/Sub transport for saga-bus.
 *
 * @example
 * ```typescript
 * import { GcpPubSubTransport } from "@saga-bus/transport-gcp-pubsub";
 *
 * const transport = new GcpPubSubTransport({
 *   projectId: "my-project",
 *   defaultTopic: "saga-events",
 *   enableOrdering: true,
 * });
 *
 * await transport.start();
 * ```
 */
export class GcpPubSubTransport implements Transport {
  private pubsub: PubSub | null = null;
  private readonly options: Required<
    Pick<
      GcpPubSubTransportOptions,
      | "subscriptionPrefix"
      | "enableOrdering"
      | "maxMessages"
      | "ackDeadlineSeconds"
      | "autoCreate"
      | "maxDeliveryAttempts"
    >
  > &
    GcpPubSubTransportOptions;

  private readonly topics = new Map<string, Topic>();
  private readonly subscriptions: Subscription[] = [];
  private started = false;

  constructor(options: GcpPubSubTransportOptions) {
    if (!options.pubsub && !options.clientConfig && !options.projectId) {
      throw new Error(
        "Either pubsub, clientConfig, or projectId must be provided"
      );
    }

    this.options = {
      subscriptionPrefix: "saga-bus-",
      enableOrdering: false,
      maxMessages: 10,
      ackDeadlineSeconds: 60,
      autoCreate: true,
      maxDeliveryAttempts: 5,
      ...options,
    };
  }

  async start(): Promise<void> {
    if (this.started) return;

    if (this.options.pubsub) {
      this.pubsub = this.options.pubsub;
    } else {
      this.pubsub = new PubSub({
        projectId: this.options.projectId,
        ...this.options.clientConfig,
      });
    }

    this.started = true;
  }

  async stop(): Promise<void> {
    if (!this.started) return;

    // Close all subscriptions
    for (const sub of this.subscriptions) {
      await sub.close();
    }
    this.subscriptions.length = 0;
    this.topics.clear();

    // Close client if we created it
    if (!this.options.pubsub && this.pubsub) {
      await this.pubsub.close();
    }
    this.pubsub = null;
    this.started = false;
  }

  async subscribe<TMessage extends BaseMessage>(
    options: TransportSubscribeOptions,
    handler: (envelope: MessageEnvelope<TMessage>) => Promise<void>
  ): Promise<void> {
    if (!this.pubsub) throw new Error("Transport not started");

    const { endpoint, group } = options;
    const topicName = endpoint;
    const subscriptionName =
      group ?? `${this.options.subscriptionPrefix}${endpoint}`;

    // Get or create topic
    let topic = this.topics.get(topicName);
    if (!topic) {
      topic = this.pubsub.topic(topicName);
      if (this.options.autoCreate) {
        const [exists] = await topic.exists();
        if (!exists) await topic.create();
      }
      this.topics.set(topicName, topic);
    }

    // Get or create subscription
    const subscription = topic.subscription(subscriptionName);
    if (this.options.autoCreate) {
      const [exists] = await subscription.exists();
      if (!exists) {
        await subscription.create({
          enableMessageOrdering: this.options.enableOrdering,
          ackDeadlineSeconds: this.options.ackDeadlineSeconds,
        });
      }
    }

    // Start listening
    subscription.on("message", async (message: Message) => {
      try {
        const rawEnvelope = JSON.parse(message.data.toString());
        const envelope: MessageEnvelope<TMessage> = {
          id: rawEnvelope.id,
          type: rawEnvelope.type,
          payload: rawEnvelope.payload as TMessage,
          headers: rawEnvelope.headers,
          timestamp: new Date(rawEnvelope.timestamp),
          partitionKey: rawEnvelope.partitionKey,
        };
        await handler(envelope);
        message.ack();
      } catch (error) {
        console.error("[GcpPubSub] Message handler error:", error);
        message.nack();
      }
    });

    subscription.on("error", (error) => {
      console.error("[GcpPubSub] Subscription error:", error);
    });

    this.subscriptions.push(subscription);
  }

  async publish<TMessage extends BaseMessage>(
    message: TMessage,
    options: TransportPublishOptions
  ): Promise<void> {
    if (!this.pubsub) throw new Error("Transport not started");

    const { endpoint, key, headers = {}, delayMs } = options;

    // GCP Pub/Sub doesn't support delayed messages natively
    if (delayMs && delayMs > 0) {
      throw new Error(
        "GCP Pub/Sub does not support delayed messages. " +
          "Use Cloud Scheduler or Cloud Tasks for delayed delivery."
      );
    }

    const topicName = endpoint ?? this.options.defaultTopic ?? message.type;

    // Get or create topic
    let topic = this.topics.get(topicName);
    if (!topic) {
      topic = this.pubsub.topic(topicName);
      if (this.options.autoCreate) {
        const [exists] = await topic.exists();
        if (!exists) await topic.create();
      }
      this.topics.set(topicName, topic);
    }

    // Create envelope
    const envelope: MessageEnvelope<TMessage> = {
      id: randomUUID(),
      type: message.type,
      payload: message,
      headers: headers as Record<string, string>,
      timestamp: new Date(),
      partitionKey: key,
    };

    // Publish
    const attributes: Record<string, string> = {
      messageType: message.type,
      messageId: envelope.id,
    };

    // Add custom headers as attributes
    for (const [k, v] of Object.entries(headers)) {
      if (typeof v === "string") {
        attributes[k] = v;
      }
    }

    if (key) {
      attributes.correlationId = key;
    }

    const publishOptions: { orderingKey?: string } = {};
    if (this.options.enableOrdering && key) {
      publishOptions.orderingKey = key;
    }

    await topic.publishMessage({
      data: Buffer.from(JSON.stringify(envelope)),
      attributes,
      ...publishOptions,
    });
  }
}
