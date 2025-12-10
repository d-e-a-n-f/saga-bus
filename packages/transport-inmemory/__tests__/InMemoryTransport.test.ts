import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { BaseMessage, MessageEnvelope } from "@saga-bus/core";
import { InMemoryTransport } from "../src/InMemoryTransport.js";

interface TestMessage extends BaseMessage {
  type: "TestMessage";
  data: string;
}

describe("InMemoryTransport", () => {
  let transport: InMemoryTransport;

  beforeEach(async () => {
    transport = new InMemoryTransport();
    await transport.start();
  });

  afterEach(async () => {
    await transport.stop();
  });

  describe("start/stop", () => {
    it("should track started state", async () => {
      const t = new InMemoryTransport();
      expect(t.isStarted).toBe(false);

      await t.start();
      expect(t.isStarted).toBe(true);

      await t.stop();
      expect(t.isStarted).toBe(false);
    });
  });

  describe("subscribe", () => {
    it("should register subscriptions", async () => {
      await transport.subscribe<TestMessage>(
        { endpoint: "test.endpoint" },
        async () => {}
      );

      expect(transport.getSubscriptionCount("test.endpoint")).toBe(1);
    });

    it("should support multiple subscriptions to same endpoint", async () => {
      await transport.subscribe<TestMessage>(
        { endpoint: "test.endpoint" },
        async () => {}
      );
      await transport.subscribe<TestMessage>(
        { endpoint: "test.endpoint" },
        async () => {}
      );

      expect(transport.getSubscriptionCount("test.endpoint")).toBe(2);
    });
  });

  describe("publish", () => {
    it("should deliver messages to subscribers", async () => {
      const received: MessageEnvelope<TestMessage>[] = [];

      await transport.subscribe<TestMessage>(
        { endpoint: "test.endpoint" },
        async (envelope) => {
          received.push(envelope);
        }
      );

      const message: TestMessage = { type: "TestMessage", data: "hello" };
      await transport.publish(message, { endpoint: "test.endpoint" });

      // Wait for async delivery
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(received).toHaveLength(1);
      expect(received[0]?.payload).toEqual(message);
      expect(received[0]?.type).toBe("TestMessage");
      expect(received[0]?.id).toBeDefined();
      expect(received[0]?.timestamp).toBeInstanceOf(Date);
    });

    it("should fan-out to multiple subscribers", async () => {
      const received1: MessageEnvelope[] = [];
      const received2: MessageEnvelope[] = [];

      await transport.subscribe<TestMessage>(
        { endpoint: "test.endpoint" },
        async (envelope) => {
          received1.push(envelope);
        }
      );
      await transport.subscribe<TestMessage>(
        { endpoint: "test.endpoint" },
        async (envelope) => {
          received2.push(envelope);
        }
      );

      await transport.publish(
        { type: "TestMessage", data: "hello" } as TestMessage,
        { endpoint: "test.endpoint" }
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
    });

    it("should not deliver to stopped transport", async () => {
      const received: MessageEnvelope[] = [];

      await transport.subscribe<TestMessage>(
        { endpoint: "test.endpoint" },
        async (envelope) => {
          received.push(envelope);
        }
      );

      await transport.stop();

      await transport.publish(
        { type: "TestMessage", data: "hello" } as TestMessage,
        { endpoint: "test.endpoint" }
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(received).toHaveLength(0);
    });

    it("should include headers in envelope", async () => {
      let receivedEnvelope: MessageEnvelope | undefined;

      await transport.subscribe<TestMessage>(
        { endpoint: "test.endpoint" },
        async (envelope) => {
          receivedEnvelope = envelope;
        }
      );

      await transport.publish(
        { type: "TestMessage", data: "hello" } as TestMessage,
        {
          endpoint: "test.endpoint",
          headers: { "x-custom": "value" },
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(receivedEnvelope?.headers["x-custom"]).toBe("value");
    });

    it("should set partition key from options", async () => {
      let receivedEnvelope: MessageEnvelope | undefined;

      await transport.subscribe<TestMessage>(
        { endpoint: "test.endpoint" },
        async (envelope) => {
          receivedEnvelope = envelope;
        }
      );

      await transport.publish(
        { type: "TestMessage", data: "hello" } as TestMessage,
        {
          endpoint: "test.endpoint",
          key: "partition-1",
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(receivedEnvelope?.partitionKey).toBe("partition-1");
    });
  });

  describe("delayed messages", () => {
    it("should delay message delivery", async () => {
      const received: number[] = [];
      const startTime = Date.now();

      await transport.subscribe<TestMessage>(
        { endpoint: "test.endpoint" },
        async () => {
          received.push(Date.now() - startTime);
        }
      );

      await transport.publish(
        { type: "TestMessage", data: "hello" } as TestMessage,
        {
          endpoint: "test.endpoint",
          delayMs: 50,
        }
      );

      // Should not be delivered immediately
      expect(received).toHaveLength(0);

      // Wait for delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(received).toHaveLength(1);
      expect(received[0]).toBeGreaterThanOrEqual(50);
    });

    it("should cancel delayed messages on stop", async () => {
      const received: MessageEnvelope[] = [];

      await transport.subscribe<TestMessage>(
        { endpoint: "test.endpoint" },
        async (envelope) => {
          received.push(envelope);
        }
      );

      await transport.publish(
        { type: "TestMessage", data: "hello" } as TestMessage,
        {
          endpoint: "test.endpoint",
          delayMs: 100,
        }
      );

      await transport.stop();

      // Wait longer than delay
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(received).toHaveLength(0);
    });
  });

  describe("concurrency", () => {
    it("should respect concurrency limit", async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      await transport.subscribe<TestMessage>(
        { endpoint: "test.endpoint", concurrency: 2 },
        async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((resolve) => setTimeout(resolve, 50));
          concurrent--;
        }
      );

      // Publish 5 messages at once
      const messages = Array.from({ length: 5 }, (_, i) => ({
        type: "TestMessage" as const,
        data: `msg-${i}`,
      }));

      for (const msg of messages) {
        await transport.publish(msg, { endpoint: "test.endpoint" });
      }

      // Wait for all to complete
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it("should use default concurrency when not specified", async () => {
      const t = new InMemoryTransport({ defaultConcurrency: 3 });
      await t.start();

      let concurrent = 0;
      let maxConcurrent = 0;

      await t.subscribe<TestMessage>(
        { endpoint: "test.endpoint" },
        async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((resolve) => setTimeout(resolve, 30));
          concurrent--;
        }
      );

      const messages = Array.from({ length: 6 }, (_, i) => ({
        type: "TestMessage" as const,
        data: `msg-${i}`,
      }));

      for (const msg of messages) {
        await t.publish(msg, { endpoint: "test.endpoint" });
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
      await t.stop();

      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });
  });
});
