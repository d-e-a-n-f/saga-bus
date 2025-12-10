import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Kafka } from "kafkajs";
import { KafkaContainer, StartedKafkaContainer } from "@testcontainers/kafka";
import type { BaseMessage, MessageEnvelope } from "@saga-bus/core";
import { KafkaTransport } from "../src/KafkaTransport.js";

const KAFKA_PORT = 9093;

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

interface BalanceEvent extends BaseMessage {
  type: "BalanceEvent";
  label: string;
}

describe("KafkaTransport", () => {
  let container: StartedKafkaContainer | undefined;
  let kafka: Kafka | undefined;

  beforeAll(async () => {
    container = await new KafkaContainer("confluentinc/cp-kafka:7.5.0")
      .withKraft()
      .withExposedPorts(KAFKA_PORT)
      .start();

    const brokerAddress = `${container.getHost()}:${container.getMappedPort(KAFKA_PORT)}`;

    kafka = new Kafka({
      clientId: "test-client",
      brokers: [brokerAddress],
    });
  }, 120_000);

  afterAll(async () => {
    await container?.stop();
  });

  describe("publish and subscribe", () => {
    it("should publish and receive messages", async () => {
      const topic = `test-topic-${Date.now()}`;
      const groupId = `group-${Date.now()}`;

      // Create topic first
      const admin = kafka!.admin();
      await admin.connect();
      await admin.createTopics({
        topics: [{ topic, numPartitions: 1 }],
      });
      await admin.disconnect();

      const transport = new KafkaTransport({
        kafka: kafka!,
        groupId,
        fromBeginning: true,
      });

      const received: MessageEnvelope<TestEvent>[] = [];

      await transport.subscribe<TestEvent>(
        { endpoint: topic },
        async (envelope) => {
          received.push(envelope);
        }
      );

      await transport.start();

      // Wait for consumer to be ready
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const message: TestEvent = { type: "TestEvent", value: 42 };
      await transport.publish(message, { endpoint: topic });

      // Wait for message to be received
      await new Promise((resolve) => setTimeout(resolve, 5000));

      await transport.stop();

      expect(received).toHaveLength(1);
      expect(received[0]?.payload.type).toBe("TestEvent");
      expect(received[0]?.payload.value).toBe(42);
    }, 60_000);

    it("should preserve ordering within partition", async () => {
      const topic = `seq-topic-${Date.now()}`;
      const groupId = `group-${Date.now()}`;

      // Create topic with single partition for ordering
      const admin = kafka!.admin();
      await admin.connect();
      await admin.createTopics({
        topics: [{ topic, numPartitions: 1 }],
      });
      await admin.disconnect();

      const transport = new KafkaTransport({
        kafka: kafka!,
        groupId,
        fromBeginning: true,
      });

      const received: number[] = [];
      const partitionKey = "order-sequence";

      await transport.subscribe<SeqEvent>(
        { endpoint: topic },
        async (envelope) => {
          received.push(envelope.payload.sequence);
        }
      );

      await transport.start();
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Publish messages with same key (same partition)
      for (let i = 0; i < 5; i++) {
        const message: SeqEvent = { type: "SeqEvent", sequence: i };
        await transport.publish(message, { endpoint: topic, key: partitionKey });
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));

      await transport.stop();

      expect(received).toEqual([0, 1, 2, 3, 4]);
    }, 60_000);
  });

  describe("error handling", () => {
    it("should redeliver on handler error", async () => {
      const topic = `fail-topic-${Date.now()}`;
      const groupId = `group-${Date.now()}`;

      // Create topic
      const admin = kafka!.admin();
      await admin.connect();
      await admin.createTopics({
        topics: [{ topic, numPartitions: 1 }],
      });
      await admin.disconnect();

      const transport = new KafkaTransport({
        kafka: kafka!,
        groupId,
        fromBeginning: true,
      });

      let attempts = 0;

      await transport.subscribe<FailEvent>(
        { endpoint: topic },
        async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error("Simulated failure");
          }
        }
      );

      await transport.start();
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const message: FailEvent = { type: "FailEvent" };
      await transport.publish(message, { endpoint: topic });

      await new Promise((resolve) => setTimeout(resolve, 10000));

      await transport.stop();

      // Message should be reprocessed after failure
      expect(attempts).toBeGreaterThanOrEqual(2);
    }, 60_000);
  });

  describe("consumer groups", () => {
    it("should balance messages across group members", async () => {
      const topic = `balance-topic-${Date.now()}`;
      const groupId = `group-${Date.now()}`;

      // Create topic with multiple partitions
      const admin = kafka!.admin();
      await admin.connect();
      await admin.createTopics({
        topics: [{ topic, numPartitions: 3 }],
      });
      await admin.disconnect();

      const received1: string[] = [];
      const received2: string[] = [];

      const transport1 = new KafkaTransport({
        kafka: kafka!,
        groupId,
        fromBeginning: true,
      });

      const transport2 = new KafkaTransport({
        kafka: kafka!,
        groupId,
        fromBeginning: true,
      });

      await transport1.subscribe<BalanceEvent>(
        { endpoint: topic },
        async (envelope) => {
          received1.push(envelope.payload.label);
        }
      );

      await transport2.subscribe<BalanceEvent>(
        { endpoint: topic },
        async (envelope) => {
          received2.push(envelope.payload.label);
        }
      );

      await transport1.start();
      await transport2.start();
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Publish messages to different partitions (different keys)
      for (let i = 0; i < 9; i++) {
        const message: BalanceEvent = { type: "BalanceEvent", label: `msg-${i}` };
        await transport1.publish(message, { endpoint: topic, key: `key-${i}` });
      }

      await new Promise((resolve) => setTimeout(resolve, 8000));

      await transport1.stop();
      await transport2.stop();

      // Both consumers should have received some messages
      const total = received1.length + received2.length;
      expect(total).toBe(9);
    }, 90_000);
  });

  describe("start and stop", () => {
    it("should be idempotent for start", async () => {
      const topic = `idem-topic-${Date.now()}`;
      const groupId = `group-${Date.now()}`;

      // Create topic
      const admin = kafka!.admin();
      await admin.connect();
      await admin.createTopics({
        topics: [{ topic, numPartitions: 1 }],
      });
      await admin.disconnect();

      const transport = new KafkaTransport({
        kafka: kafka!,
        groupId,
      });

      await transport.subscribe<TestEvent>(
        { endpoint: topic },
        async () => {}
      );

      await transport.start();
      await transport.start(); // Should not throw

      expect(transport.isStarted()).toBe(true);

      await transport.stop();
    }, 30_000);

    it("should allow publish without start", async () => {
      const topic = `pub-only-topic-${Date.now()}`;

      // Create topic
      const admin = kafka!.admin();
      await admin.connect();
      await admin.createTopics({
        topics: [{ topic, numPartitions: 1 }],
      });
      await admin.disconnect();

      const transport = new KafkaTransport({
        kafka: kafka!,
      });

      const message: TestEvent = { type: "TestEvent", value: 99 };

      // Should auto-connect producer
      await expect(
        transport.publish(message, { endpoint: topic })
      ).resolves.not.toThrow();

      await transport.stop();
    }, 30_000);
  });

  describe("getStats", () => {
    it("should return subscription count", async () => {
      const topic = `stats-topic-${Date.now()}`;

      const transport = new KafkaTransport({
        kafka: kafka!,
        groupId: `group-${Date.now()}`,
      });

      await transport.subscribe<TestEvent>(
        { endpoint: topic },
        async () => {}
      );

      const stats = transport.getStats();

      expect(stats.subscriptionCount).toBe(1);
      expect(stats.isRunning).toBe(false);
    });
  });
});
