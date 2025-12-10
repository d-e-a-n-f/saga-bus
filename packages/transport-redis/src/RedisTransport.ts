import { Redis } from "ioredis";
import { randomUUID } from "crypto";
import {
  type Transport,
  type TransportSubscribeOptions,
  type TransportPublishOptions,
  type MessageEnvelope,
  type BaseMessage,
} from "@saga-bus/core";
import type {
  RedisTransportOptions,
  StreamSubscription,
  DelayedMessageEntry,
} from "./types.js";

/**
 * Redis Streams transport implementation for saga-bus.
 *
 * Uses Redis Streams (XADD/XREADGROUP) for message delivery with:
 * - Consumer groups for competing consumers
 * - Message acknowledgment (XACK)
 * - Delayed messages via sorted sets (ZADD/ZRANGEBYSCORE)
 * - Pending message claiming (XCLAIM) for recovery
 *
 * @example
 * ```typescript
 * import Redis from "ioredis";
 * import { RedisTransport } from "@saga-bus/transport-redis";
 *
 * const transport = new RedisTransport({
 *   redis: new Redis(),
 *   consumerGroup: "order-processor",
 * });
 *
 * await transport.start();
 * ```
 */
export class RedisTransport implements Transport {
  private redis: Redis | null = null;
  private subscriberRedis: Redis | null = null;
  private readonly options: Required<
    Pick<
      RedisTransportOptions,
      | "keyPrefix"
      | "consumerGroup"
      | "consumerName"
      | "autoCreateGroup"
      | "batchSize"
      | "blockTimeoutMs"
      | "maxStreamLength"
      | "approximateMaxLen"
      | "delayedPollIntervalMs"
      | "delayedSetKey"
      | "pendingClaimIntervalMs"
      | "minIdleTimeMs"
    >
  > &
    RedisTransportOptions;

  private readonly subscriptions: StreamSubscription[] = [];
  private started = false;
  private stopping = false;
  private readLoopPromise: Promise<void> | null = null;
  private delayedPollInterval: ReturnType<typeof setInterval> | null = null;
  private pendingClaimInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: RedisTransportOptions) {
    if (!options.redis && !options.connection) {
      throw new Error("Either redis client or connection options must be provided");
    }

    this.options = {
      keyPrefix: "saga-bus:",
      consumerGroup: "",
      consumerName: `consumer-${randomUUID()}`,
      autoCreateGroup: true,
      batchSize: 10,
      blockTimeoutMs: 5000,
      maxStreamLength: 0,
      approximateMaxLen: true,
      delayedPollIntervalMs: 1000,
      delayedSetKey: "saga-bus:delayed",
      pendingClaimIntervalMs: 30000,
      minIdleTimeMs: 60000,
      ...options,
    };
  }

  async start(): Promise<void> {
    if (this.started) return;

    // Create Redis clients
    if (this.options.redis) {
      this.redis = this.options.redis;
      // Create a separate connection for blocking reads
      this.subscriberRedis = this.options.redis.duplicate();
    } else if (this.options.connection) {
      this.redis = new Redis(this.options.connection);
      this.subscriberRedis = new Redis(this.options.connection);
    } else {
      throw new Error("Invalid configuration");
    }

    // Create consumer groups for all subscribed streams
    if (this.options.autoCreateGroup && this.options.consumerGroup) {
      for (const sub of this.subscriptions) {
        await this.ensureConsumerGroup(sub.streamKey);
      }
    }

    this.started = true;

    // Start the read loop if we have subscriptions
    if (this.subscriptions.length > 0) {
      this.readLoopPromise = this.readLoop();
    }

    // Start delayed message polling
    if (this.options.delayedPollIntervalMs > 0) {
      this.delayedPollInterval = setInterval(
        () => void this.processDelayedMessages(),
        this.options.delayedPollIntervalMs
      );
    }

    // Start pending message claiming
    if (this.options.pendingClaimIntervalMs > 0) {
      this.pendingClaimInterval = setInterval(
        () => void this.claimPendingMessages(),
        this.options.pendingClaimIntervalMs
      );
    }
  }

  async stop(): Promise<void> {
    if (!this.started || this.stopping) return;
    this.stopping = true;

    // Stop polling intervals
    if (this.delayedPollInterval) {
      clearInterval(this.delayedPollInterval);
      this.delayedPollInterval = null;
    }

    if (this.pendingClaimInterval) {
      clearInterval(this.pendingClaimInterval);
      this.pendingClaimInterval = null;
    }

    // Wait for read loop to finish
    if (this.readLoopPromise) {
      await this.readLoopPromise;
      this.readLoopPromise = null;
    }

    // Close subscriber connection
    if (this.subscriberRedis && this.subscriberRedis !== this.options.redis) {
      await this.subscriberRedis.quit();
    }
    this.subscriberRedis = null;

    // Close main connection if we created it
    if (this.redis && !this.options.redis) {
      await this.redis.quit();
    }
    this.redis = null;

    this.started = false;
    this.stopping = false;
  }

  async subscribe<TMessage extends BaseMessage>(
    options: TransportSubscribeOptions,
    handler: (envelope: MessageEnvelope<TMessage>) => Promise<void>
  ): Promise<void> {
    const { endpoint, concurrency = 1 } = options;
    const streamKey = `${this.options.keyPrefix}stream:${endpoint}`;

    const subscription: StreamSubscription = {
      streamKey,
      handler: handler as (envelope: unknown) => Promise<void>,
      concurrency,
    };

    this.subscriptions.push(subscription);

    // If already started, create consumer group and restart read loop
    if (this.started && this.redis) {
      await this.ensureConsumerGroup(streamKey);

      // Restart read loop with new subscription
      if (!this.readLoopPromise) {
        this.readLoopPromise = this.readLoop();
      }
    }
  }

  async publish<TMessage extends BaseMessage>(
    message: TMessage,
    options: TransportPublishOptions
  ): Promise<void> {
    if (!this.redis) {
      throw new Error("Transport not started");
    }

    const { endpoint, key, headers = {}, delayMs } = options;
    const streamKey = `${this.options.keyPrefix}stream:${endpoint}`;

    // Create message envelope
    const envelope: MessageEnvelope<TMessage> = {
      id: randomUUID(),
      type: message.type,
      payload: message,
      headers: headers as Record<string, string>,
      timestamp: new Date(),
      partitionKey: key,
    };

    const envelopeJson = JSON.stringify(envelope);

    // Handle delayed delivery
    if (delayMs && delayMs > 0) {
      const deliverAt = Date.now() + delayMs;
      const delayedEntry: DelayedMessageEntry = {
        streamKey,
        envelope: envelopeJson,
        deliverAt,
      };

      // Store in sorted set with score = delivery timestamp
      await this.redis.zadd(
        this.options.delayedSetKey,
        deliverAt,
        JSON.stringify(delayedEntry)
      );
      return;
    }

    // Immediate delivery via stream
    await this.addToStream(streamKey, envelopeJson);
  }

  private async addToStream(streamKey: string, envelopeJson: string): Promise<void> {
    if (!this.redis) return;

    const args: (string | number)[] = [streamKey];

    // Add MAXLEN if configured
    if (this.options.maxStreamLength > 0) {
      if (this.options.approximateMaxLen) {
        args.push("MAXLEN", "~", this.options.maxStreamLength);
      } else {
        args.push("MAXLEN", this.options.maxStreamLength);
      }
    }

    args.push("*", "data", envelopeJson);

    await this.redis.xadd(...(args as [string, ...Array<string | number>]));
  }

  private async ensureConsumerGroup(streamKey: string): Promise<void> {
    if (!this.redis || !this.options.consumerGroup) return;

    try {
      // Create stream with empty entry if it doesn't exist, then create group
      await this.redis.xgroup(
        "CREATE",
        streamKey,
        this.options.consumerGroup,
        "0",
        "MKSTREAM"
      );
    } catch (error) {
      // Ignore "BUSYGROUP Consumer Group name already exists" error
      if (
        error instanceof Error &&
        !error.message.includes("BUSYGROUP")
      ) {
        throw error;
      }
    }
  }

  private async readLoop(): Promise<void> {
    if (!this.subscriberRedis || !this.options.consumerGroup) return;

    const streams = this.subscriptions.map((s) => s.streamKey);
    const ids = streams.map(() => ">"); // Only new messages

    while (this.started && !this.stopping) {
      try {
        const results = await this.subscriberRedis.xreadgroup(
          "GROUP",
          this.options.consumerGroup,
          this.options.consumerName,
          "COUNT",
          this.options.batchSize,
          "BLOCK",
          this.options.blockTimeoutMs,
          "STREAMS",
          ...streams,
          ...ids
        );

        if (!results) continue;

        // Process messages - results is Array<[streamKey, messages]>
        const typedResults = results as Array<
          [string, Array<[string, string[]]>]
        >;
        for (const [streamKey, messages] of typedResults) {
          const subscription = this.subscriptions.find(
            (s) => s.streamKey === streamKey
          );
          if (!subscription) continue;

          for (const [messageId, fields] of messages) {
            await this.processMessage(
              streamKey,
              messageId,
              fields,
              subscription
            );
          }
        }
      } catch (error) {
        if (!this.stopping) {
          console.error("[RedisTransport] Read loop error:", error);
          // Brief pause before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
  }

  private async processMessage(
    streamKey: string,
    messageId: string,
    fields: string[],
    subscription: StreamSubscription
  ): Promise<void> {
    if (!this.redis) return;

    try {
      // Parse fields array into object
      const data: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        data[fields[i]!] = fields[i + 1]!;
      }

      if (!data.data) {
        console.error("[RedisTransport] Message missing data field:", messageId);
        await this.acknowledgeMessage(streamKey, messageId);
        return;
      }

      const rawEnvelope = JSON.parse(data.data) as {
        id: string;
        type: string;
        payload: unknown;
        headers: Record<string, string>;
        timestamp: string | Date;
        partitionKey?: string;
      };

      // Reconstruct Date objects into proper envelope
      const envelope: MessageEnvelope = {
        id: rawEnvelope.id,
        type: rawEnvelope.type,
        payload: rawEnvelope.payload as BaseMessage,
        headers: rawEnvelope.headers,
        timestamp: new Date(rawEnvelope.timestamp),
        partitionKey: rawEnvelope.partitionKey,
      };

      await subscription.handler(envelope);

      // Acknowledge successful processing
      await this.acknowledgeMessage(streamKey, messageId);
    } catch (error) {
      console.error("[RedisTransport] Message processing error:", error);
      // Don't acknowledge - message will be claimed by pending recovery
    }
  }

  private async acknowledgeMessage(
    streamKey: string,
    messageId: string
  ): Promise<void> {
    if (!this.redis || !this.options.consumerGroup) return;

    await this.redis.xack(streamKey, this.options.consumerGroup, messageId);
  }

  private async processDelayedMessages(): Promise<void> {
    if (!this.redis || this.stopping) return;

    try {
      const now = Date.now();

      // Get all messages due for delivery
      const entries = await this.redis.zrangebyscore(
        this.options.delayedSetKey,
        "-inf",
        now
      );

      if (entries.length === 0) return;

      // Process each delayed message
      for (const entryJson of entries) {
        try {
          const entry = JSON.parse(entryJson) as DelayedMessageEntry;

          // Add to the target stream
          await this.addToStream(entry.streamKey, entry.envelope);

          // Remove from delayed set
          await this.redis.zrem(this.options.delayedSetKey, entryJson);
        } catch (error) {
          console.error("[RedisTransport] Error processing delayed message:", error);
        }
      }
    } catch (error) {
      console.error("[RedisTransport] Error in delayed message poll:", error);
    }
  }

  private async claimPendingMessages(): Promise<void> {
    if (!this.redis || !this.options.consumerGroup || this.stopping) return;

    for (const subscription of this.subscriptions) {
      try {
        // Get pending messages for this stream
        const pending = await this.redis.xpending(
          subscription.streamKey,
          this.options.consumerGroup,
          "-",
          "+",
          10 // Max entries to check
        );

        if (!Array.isArray(pending) || pending.length === 0) continue;

        for (const entry of pending) {
          if (!Array.isArray(entry) || entry.length < 4) continue;

          const [messageId, , idleTime] = entry as [string, string, number, number];

          // Only claim if idle time exceeds threshold
          if (idleTime < this.options.minIdleTimeMs) continue;

          try {
            // Claim the message
            const claimed = await this.redis.xclaim(
              subscription.streamKey,
              this.options.consumerGroup,
              this.options.consumerName,
              this.options.minIdleTimeMs,
              messageId
            );

            if (claimed && claimed.length > 0) {
              // Process the claimed message
              const [claimedId, fields] = claimed[0] as [string, string[]];
              await this.processMessage(
                subscription.streamKey,
                claimedId,
                fields,
                subscription
              );
            }
          } catch (error) {
            console.error("[RedisTransport] Error claiming message:", error);
          }
        }
      } catch (error) {
        console.error("[RedisTransport] Error in pending claim:", error);
      }
    }
  }
}
