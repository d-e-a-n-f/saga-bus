import { randomUUID } from "node:crypto";
import {
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  type SQSClient,
  type Message as SqsMessage,
} from "@aws-sdk/client-sqs";
import type {
  Transport,
  TransportSubscribeOptions,
  TransportPublishOptions,
  BaseMessage,
  MessageEnvelope,
} from "@saga-bus/core";
import type { SqsTransportOptions, SqsSubscription } from "./types.js";

/**
 * AWS SQS FIFO transport for saga-bus.
 *
 * Uses FIFO queues to guarantee message ordering within message groups.
 * The partition key or correlation ID is used as the message group ID.
 *
 * @example
 * ```typescript
 * import { SQSClient } from "@aws-sdk/client-sqs";
 *
 * const client = new SQSClient({ region: "us-east-1" });
 * const transport = new SqsTransport({
 *   client,
 *   queueUrl: "https://sqs.us-east-1.amazonaws.com/123456789/my-queue.fifo",
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
 *   { endpoint: "OrderSubmitted", key: "order-123" }
 * );
 * ```
 */
export class SqsTransport implements Transport {
  private readonly client: SQSClient;
  private readonly queueUrl: string;
  private readonly maxMessages: number;
  private readonly waitTimeSeconds: number;
  private readonly visibilityTimeout: number;
  private readonly concurrency: number;

  private readonly handlers = new Map<
    string,
    (envelope: MessageEnvelope) => Promise<void>
  >();
  private readonly subscriptions: SqsSubscription[] = [];
  private isRunning = false;
  private pollLoops: Promise<void>[] = [];

  constructor(options: SqsTransportOptions) {
    this.client = options.client;
    this.queueUrl = options.queueUrl;
    this.maxMessages = options.maxMessages ?? 10;
    this.waitTimeSeconds = options.waitTimeSeconds ?? 20;
    this.visibilityTimeout = options.visibilityTimeout ?? 30;
    this.concurrency = options.concurrency ?? 1;

    if (!this.queueUrl.endsWith(".fifo")) {
      throw new Error(
        "SqsTransport requires a FIFO queue (URL must end with .fifo)"
      );
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Start concurrent poll loops
    for (let i = 0; i < this.concurrency; i++) {
      this.pollLoops.push(this.pollLoop());
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await Promise.all(this.pollLoops);
    this.pollLoops = [];
  }

  async subscribe<TMessage extends BaseMessage>(
    options: TransportSubscribeOptions,
    handler: (envelope: MessageEnvelope<TMessage>) => Promise<void>
  ): Promise<void> {
    const { endpoint } = options;

    // Store handler (SQS uses single queue, filter by endpoint in handler)
    this.handlers.set(
      endpoint,
      handler as (envelope: MessageEnvelope) => Promise<void>
    );

    this.subscriptions.push({
      endpoint,
      concurrency: options.concurrency ?? 1,
    });
  }

  async publish<TMessage extends BaseMessage>(
    message: TMessage,
    options: TransportPublishOptions
  ): Promise<void> {
    const { endpoint, key, headers = {}, delayMs } = options;

    // Create envelope
    const envelope: MessageEnvelope<TMessage> = {
      id: randomUUID(),
      type: message.type,
      payload: message,
      headers: { ...headers, "x-endpoint": endpoint },
      timestamp: new Date(),
      partitionKey: key,
    };

    // Message group ID for FIFO ordering
    const messageGroupId = key ?? envelope.id;

    // Calculate delay in seconds (SQS supports 0-900 seconds)
    const delaySeconds = delayMs ? Math.min(Math.floor(delayMs / 1000), 900) : undefined;

    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(envelope),
        MessageGroupId: messageGroupId,
        MessageDeduplicationId: envelope.id,
        DelaySeconds: delaySeconds,
      })
    );
  }

  private async pollLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.pollMessages();
      } catch (error) {
        // Log error but continue polling
        console.error("[SQS] Poll error:", error);
        await this.delay(1000);
      }
    }
  }

  private async pollMessages(): Promise<void> {
    const response = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: this.maxMessages,
        WaitTimeSeconds: this.waitTimeSeconds,
        VisibilityTimeout: this.visibilityTimeout,
        AttributeNames: ["All"],
        MessageAttributeNames: ["All"],
      })
    );

    if (!response.Messages || response.Messages.length === 0) {
      return;
    }

    await Promise.all(
      response.Messages.map((msg) => this.processMessage(msg))
    );
  }

  private async processMessage(sqsMessage: SqsMessage): Promise<void> {
    if (!sqsMessage.Body || !sqsMessage.ReceiptHandle) {
      return;
    }

    try {
      // Parse envelope
      const parsed = JSON.parse(sqsMessage.Body) as MessageEnvelope;

      // Reconstruct Date objects
      const envelope: MessageEnvelope = {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
      };

      // Get endpoint from headers
      const endpoint = envelope.headers["x-endpoint"];

      // Find handler for this endpoint
      const handler = endpoint ? this.handlers.get(endpoint) : undefined;

      // If no specific handler, try to find any handler (for simple cases)
      const actualHandler = handler ?? this.handlers.values().next().value;

      if (actualHandler) {
        await actualHandler(envelope);
      }

      // Delete message on successful processing
      await this.client.send(
        new DeleteMessageCommand({
          QueueUrl: this.queueUrl,
          ReceiptHandle: sqsMessage.ReceiptHandle,
        })
      );
    } catch (error) {
      // Message will return to queue after visibility timeout
      console.error("[SQS] Message processing error:", error);
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
