import {
  connect,
  NatsConnection,
  JetStreamManager,
  JetStreamClient,
  JetStreamPublishOptions,
  ConsumerConfig,
  AckPolicy,
  DeliverPolicy,
  StringCodec,
  headers,
  RetentionPolicy,
} from "nats";
import type {
  Transport,
  TransportSubscribeOptions,
  TransportPublishOptions,
  MessageEnvelope,
  BaseMessage,
} from "@saga-bus/core";
import type { NatsTransportOptions } from "./types.js";
import { randomUUID } from "crypto";

const sc = StringCodec();

/**
 * NATS JetStream transport for saga-bus.
 *
 * @example
 * ```typescript
 * import { NatsTransport } from "@saga-bus/transport-nats";
 *
 * const transport = new NatsTransport({
 *   connectionOptions: { servers: "localhost:4222" },
 *   streamName: "SAGA_EVENTS",
 * });
 *
 * await transport.start();
 * ```
 */
export class NatsTransport implements Transport {
  private nc: NatsConnection | null = null;
  private jsm: JetStreamManager | null = null;
  private js: JetStreamClient | null = null;
  private readonly options: Required<
    Pick<
      NatsTransportOptions,
      | "subjectPrefix"
      | "streamName"
      | "consumerPrefix"
      | "autoCreateStream"
      | "retentionPolicy"
      | "maxMessages"
      | "maxBytes"
      | "replicas"
      | "ackWait"
      | "maxDeliver"
    >
  > &
    NatsTransportOptions;

  private readonly consumers: Array<{ stop: () => void }> = [];
  private started = false;

  constructor(options: NatsTransportOptions) {
    if (!options.connection && !options.connectionOptions) {
      throw new Error(
        "Either connection or connectionOptions must be provided"
      );
    }

    this.options = {
      subjectPrefix: "saga-bus",
      streamName: "SAGA_BUS",
      consumerPrefix: "saga-bus-consumer",
      autoCreateStream: true,
      retentionPolicy: "workqueue",
      maxMessages: -1,
      maxBytes: -1,
      replicas: 1,
      ackWait: 30_000_000_000, // 30 seconds in nanoseconds
      maxDeliver: 5,
      ...options,
    };
  }

  async start(): Promise<void> {
    if (this.started) return;

    // Connect
    if (this.options.connection) {
      this.nc = this.options.connection;
    } else {
      this.nc = await connect(this.options.connectionOptions);
    }

    // Get JetStream manager and client
    this.jsm = await this.nc.jetstreamManager(this.options.jetStreamOptions);
    this.js = this.nc.jetstream(this.options.jetStreamOptions);

    // Create stream if needed
    if (this.options.autoCreateStream) {
      await this.ensureStream();
    }

    this.started = true;
  }

  async stop(): Promise<void> {
    if (!this.started) return;

    // Stop all consumers
    for (const consumer of this.consumers) {
      consumer.stop();
    }
    this.consumers.length = 0;

    // Close connection if we created it
    if (!this.options.connection && this.nc) {
      await this.nc.drain();
    }

    this.nc = null;
    this.jsm = null;
    this.js = null;
    this.started = false;
  }

  async subscribe<TMessage extends BaseMessage>(
    options: TransportSubscribeOptions,
    handler: (envelope: MessageEnvelope<TMessage>) => Promise<void>
  ): Promise<void> {
    if (!this.js || !this.jsm) throw new Error("Transport not started");

    const { endpoint, group } = options;
    const subject = `${this.options.subjectPrefix}.${endpoint}.>`;
    const consumerName = group ?? `${this.options.consumerPrefix}-${endpoint}`;

    // Create durable consumer
    const consumerConfig: Partial<ConsumerConfig> = {
      durable_name: consumerName,
      filter_subject: subject,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      ack_wait: this.options.ackWait,
      max_deliver: this.options.maxDeliver,
    };

    await this.jsm.consumers.add(this.options.streamName, consumerConfig);

    // Subscribe
    const consumer = await this.js.consumers.get(
      this.options.streamName,
      consumerName
    );
    const messages = await consumer.consume();

    // Process messages asynchronously
    (async () => {
      for await (const msg of messages) {
        try {
          const rawEnvelope = JSON.parse(sc.decode(msg.data));
          const envelope: MessageEnvelope<TMessage> = {
            id: rawEnvelope.id,
            type: rawEnvelope.type,
            payload: rawEnvelope.payload as TMessage,
            headers: rawEnvelope.headers,
            timestamp: new Date(rawEnvelope.timestamp),
            partitionKey: rawEnvelope.partitionKey,
          };
          await handler(envelope);
          msg.ack();
        } catch (error) {
          console.error("[NatsTransport] Message handler error:", error);
          msg.nak();
        }
      }
    })();

    this.consumers.push({ stop: () => messages.stop() });
  }

  async publish<TMessage extends BaseMessage>(
    message: TMessage,
    options: TransportPublishOptions
  ): Promise<void> {
    if (!this.js) throw new Error("Transport not started");

    const { endpoint, key, headers: customHeaders = {}, delayMs } = options;

    // NATS JetStream doesn't support delayed messages natively
    if (delayMs && delayMs > 0) {
      throw new Error(
        "NATS JetStream does not support delayed messages. " +
          "Use an external scheduler for delayed delivery."
      );
    }

    const subject = `${this.options.subjectPrefix}.${endpoint}.${message.type}`;

    // Create envelope
    const envelope: MessageEnvelope<TMessage> = {
      id: randomUUID(),
      type: message.type,
      payload: message,
      headers: customHeaders as Record<string, string>,
      timestamp: new Date(),
      partitionKey: key,
    };

    // Build headers
    const h = headers();
    h.set("Nats-Msg-Id", envelope.id);
    h.set("X-Message-Type", message.type);
    if (key) h.set("X-Correlation-Id", key);
    for (const [k, v] of Object.entries(customHeaders)) {
      if (typeof v === "string") {
        h.set(k, v);
      }
    }

    // Publish
    const publishOptions: Partial<JetStreamPublishOptions> = {
      msgID: envelope.id,
      headers: h,
    };

    await this.js.publish(
      subject,
      sc.encode(JSON.stringify(envelope)),
      publishOptions
    );
  }

  private async ensureStream(): Promise<void> {
    if (!this.jsm) return;

    try {
      await this.jsm.streams.info(this.options.streamName);
    } catch {
      // Stream doesn't exist, create it
      const retentionMap: Record<string, RetentionPolicy> = {
        limits: RetentionPolicy.Limits,
        interest: RetentionPolicy.Interest,
        workqueue: RetentionPolicy.Workqueue,
      };

      await this.jsm.streams.add({
        name: this.options.streamName,
        subjects: [`${this.options.subjectPrefix}.>`],
        retention: retentionMap[this.options.retentionPolicy],
        max_msgs: this.options.maxMessages,
        max_bytes: this.options.maxBytes,
        num_replicas: this.options.replicas,
      });
    }
  }
}
