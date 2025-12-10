import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  SQSClient,
  CreateQueueCommand,
  DeleteQueueCommand,
  PurgeQueueCommand,
  GetQueueUrlCommand,
} from "@aws-sdk/client-sqs";
import {
  LocalstackContainer,
  StartedLocalStackContainer,
} from "@testcontainers/localstack";
import type { BaseMessage, MessageEnvelope } from "@saga-bus/core";
import { SqsTransport } from "../src/SqsTransport.js";

interface TestEvent extends BaseMessage {
  type: "TestEvent";
  value: number;
}

interface SeqEvent extends BaseMessage {
  type: "SeqEvent";
  sequence: number;
}

interface FailEvent extends BaseMessage {
  type: "FailEvent";
}

interface ConcurrentEvent extends BaseMessage {
  type: "ConcurrentEvent";
  label: string;
}

describe("SqsTransport", () => {
  let container: StartedLocalStackContainer | undefined;
  let client: SQSClient | undefined;
  let queueUrl: string | undefined;
  const queueName = "test-queue.fifo";

  beforeAll(async () => {
    container = await new LocalstackContainer("localstack/localstack:3").start();

    client = new SQSClient({
      endpoint: container.getConnectionUri(),
      region: "us-east-1",
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    });

    // Create FIFO queue
    await client.send(
      new CreateQueueCommand({
        QueueName: queueName,
        Attributes: {
          FifoQueue: "true",
          ContentBasedDeduplication: "false",
        },
      })
    );

    const urlResult = await client.send(
      new GetQueueUrlCommand({ QueueName: queueName })
    );
    queueUrl = urlResult.QueueUrl;
  }, 120_000);

  afterAll(async () => {
    if (queueUrl && client) {
      await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
    }
    await container?.stop();
  });

  beforeEach(async () => {
    if (queueUrl && client) {
      try {
        await client.send(new PurgeQueueCommand({ QueueUrl: queueUrl }));
        // Wait for purge to take effect
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch {
        // Ignore purge errors (rate limiting)
      }
    }
  }, 30_000);

  describe("constructor", () => {
    it("should reject non-FIFO queue URLs", () => {
      expect(
        () =>
          new SqsTransport({
            client: client!,
            queueUrl: "https://sqs.us-east-1.amazonaws.com/123/standard-queue",
          })
      ).toThrow("FIFO queue");
    });

    it("should accept FIFO queue URLs", () => {
      expect(
        () =>
          new SqsTransport({
            client: client!,
            queueUrl: queueUrl!,
          })
      ).not.toThrow();
    });
  });

  describe("publish and subscribe", () => {
    it("should publish and receive messages", async () => {
      const transport = new SqsTransport({
        client: client!,
        queueUrl: queueUrl!,
        waitTimeSeconds: 1,
      });

      const received: MessageEnvelope<TestEvent>[] = [];

      await transport.subscribe<TestEvent>(
        { endpoint: "TestEvent" },
        async (envelope) => {
          received.push(envelope);
        }
      );

      await transport.start();

      const message: TestEvent = { type: "TestEvent", value: 42 };
      await transport.publish(message, { endpoint: "TestEvent" });

      // Wait for message to be received
      await new Promise((resolve) => setTimeout(resolve, 3000));

      await transport.stop();

      expect(received).toHaveLength(1);
      expect(received[0]?.payload.type).toBe("TestEvent");
      expect(received[0]?.payload.value).toBe(42);
    }, 30_000);

    it("should maintain FIFO ordering within message group", async () => {
      const transport = new SqsTransport({
        client: client!,
        queueUrl: queueUrl!,
        waitTimeSeconds: 1,
        concurrency: 1,
      });

      const received: number[] = [];
      const groupKey = `order-group-${Date.now()}`;

      await transport.subscribe<SeqEvent>(
        { endpoint: "SeqEvent" },
        async (envelope) => {
          received.push(envelope.payload.sequence);
        }
      );

      await transport.start();

      // Publish 5 messages in order with same message group
      for (let i = 0; i < 5; i++) {
        const message: SeqEvent = { type: "SeqEvent", sequence: i };
        await transport.publish(message, { endpoint: "SeqEvent", key: groupKey });
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));

      await transport.stop();

      expect(received).toEqual([0, 1, 2, 3, 4]);
    }, 30_000);
  });

  describe("error handling", () => {
    it("should not delete message on handler error", async () => {
      const transport = new SqsTransport({
        client: client!,
        queueUrl: queueUrl!,
        waitTimeSeconds: 1,
        visibilityTimeout: 2,
      });

      let attempts = 0;

      await transport.subscribe<FailEvent>(
        { endpoint: "FailEvent" },
        async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error("Simulated failure");
          }
        }
      );

      await transport.start();

      const message: FailEvent = { type: "FailEvent" };
      await transport.publish(message, { endpoint: "FailEvent" });

      // Wait for retry after visibility timeout
      await new Promise((resolve) => setTimeout(resolve, 8000));

      await transport.stop();

      expect(attempts).toBeGreaterThanOrEqual(2);
    }, 30_000);
  });

  describe("concurrency", () => {
    it("should process messages with multiple workers", async () => {
      const transport = new SqsTransport({
        client: client!,
        queueUrl: queueUrl!,
        waitTimeSeconds: 1,
        concurrency: 3,
      });

      const received: string[] = [];

      await transport.subscribe<ConcurrentEvent>(
        { endpoint: "ConcurrentEvent" },
        async (envelope) => {
          received.push(envelope.payload.label);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      );

      await transport.start();

      // Publish to different message groups for parallel processing
      for (let i = 0; i < 9; i++) {
        const message: ConcurrentEvent = { type: "ConcurrentEvent", label: `msg-${i}` };
        await transport.publish(message, {
          endpoint: "ConcurrentEvent",
          key: `group-${i % 3}-${Date.now()}`,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));

      await transport.stop();

      expect(received).toHaveLength(9);
    }, 30_000);
  });

  describe("start and stop", () => {
    it("should be idempotent for start", async () => {
      const transport = new SqsTransport({
        client: client!,
        queueUrl: queueUrl!,
      });

      await transport.subscribe<TestEvent>(
        { endpoint: "TestEvent" },
        async () => {}
      );

      await transport.start();
      await transport.start(); // Should not throw

      expect(transport.isStarted()).toBe(true);

      await transport.stop();
    });

    it("should be idempotent for stop", async () => {
      const transport = new SqsTransport({
        client: client!,
        queueUrl: queueUrl!,
      });

      await transport.subscribe<TestEvent>(
        { endpoint: "TestEvent" },
        async () => {}
      );

      await transport.start();
      await transport.stop();
      await transport.stop(); // Should not throw

      expect(transport.isStarted()).toBe(false);
    });
  });

  describe("getStats", () => {
    it("should return subscription count", async () => {
      const transport = new SqsTransport({
        client: client!,
        queueUrl: queueUrl!,
      });

      await transport.subscribe<TestEvent>(
        { endpoint: "TestEvent" },
        async () => {}
      );

      const stats = transport.getStats();

      expect(stats.subscriptionCount).toBe(1);
      expect(stats.isRunning).toBe(false);
    });
  });
});
