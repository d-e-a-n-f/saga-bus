import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import {
  RabbitMQContainer,
  type StartedRabbitMQContainer,
} from "@testcontainers/rabbitmq";
import type { BaseMessage, MessageEnvelope } from "@saga-bus/core";
import { RabbitMqTransport } from "../src/RabbitMqTransport.js";

interface TestMessage extends BaseMessage {
  type: "TestMessage";
  data: string;
}

describe("RabbitMqTransport", () => {
  let container: StartedRabbitMQContainer | undefined;
  let amqpUri: string;

  beforeAll(async () => {
    // Start RabbitMQ container
    container = await new RabbitMQContainer("rabbitmq:3-management")
      .withExposedPorts(5672, 15672)
      .start();

    amqpUri = container.getAmqpUrl();
  }, 120_000);

  afterAll(async () => {
    await container?.stop();
  });

  describe("connection", () => {
    it("should connect and disconnect", async () => {
      const transport = new RabbitMqTransport({
        uri: amqpUri,
        exchange: "test-exchange",
      });

      await transport.start();
      expect(transport.isConnected()).toBe(true);

      await transport.stop();
      expect(transport.isConnected()).toBe(false);
    });

    it("should handle multiple start calls", async () => {
      const transport = new RabbitMqTransport({
        uri: amqpUri,
        exchange: "test-exchange",
      });

      await transport.start();
      await transport.start(); // Should not throw

      expect(transport.isConnected()).toBe(true);

      await transport.stop();
    });
  });

  describe("publish and subscribe", () => {
    let transport: RabbitMqTransport;

    beforeEach(async () => {
      transport = new RabbitMqTransport({
        uri: amqpUri,
        exchange: "test-exchange-" + Date.now(),
      });
      await transport.start();
    });

    afterEach(async () => {
      await transport.stop();
    });

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
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(received).toHaveLength(1);
      expect(received[0]?.payload).toEqual(message);
      expect(received[0]?.type).toBe("TestMessage");
      expect(received[0]?.id).toBeDefined();
    });

    it("should support multiple subscribers with groups", async () => {
      const received1: MessageEnvelope[] = [];
      const received2: MessageEnvelope[] = [];

      await transport.subscribe<TestMessage>(
        { endpoint: "test.endpoint", group: "group1" },
        async (envelope) => {
          received1.push(envelope);
        }
      );

      await transport.subscribe<TestMessage>(
        { endpoint: "test.endpoint", group: "group2" },
        async (envelope) => {
          received2.push(envelope);
        }
      );

      await transport.publish(
        { type: "TestMessage", data: "hello" } as TestMessage,
        { endpoint: "test.endpoint" }
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Both groups should receive the message (fanout to queues)
      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
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

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(receivedEnvelope?.headers["x-custom"]).toBe("value");
    });
  });

  describe("concurrency", () => {
    let transport: RabbitMqTransport;

    beforeEach(async () => {
      transport = new RabbitMqTransport({
        uri: amqpUri,
        exchange: "test-exchange-concurrent-" + Date.now(),
      });
      await transport.start();
    });

    afterEach(async () => {
      await transport.stop();
    });

    it("should respect concurrency limit via prefetch", async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      await transport.subscribe<TestMessage>(
        { endpoint: "test.endpoint", concurrency: 2 },
        async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((resolve) => setTimeout(resolve, 100));
          concurrent--;
        }
      );

      // Publish 5 messages
      for (let i = 0; i < 5; i++) {
        await transport.publish(
          { type: "TestMessage", data: `msg-${i}` } as TestMessage,
          { endpoint: "test.endpoint" }
        );
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });

  describe("statistics", () => {
    it("should track subscription count", async () => {
      const transport = new RabbitMqTransport({
        uri: amqpUri,
        exchange: "test-exchange-stats",
      });

      await transport.start();

      expect(transport.getStats().subscriptionCount).toBe(0);

      await transport.subscribe<TestMessage>(
        { endpoint: "endpoint1" },
        async () => {}
      );

      expect(transport.getStats().subscriptionCount).toBe(1);

      await transport.subscribe<TestMessage>(
        { endpoint: "endpoint2" },
        async () => {}
      );

      expect(transport.getStats().subscriptionCount).toBe(2);

      await transport.stop();
    });
  });
});
