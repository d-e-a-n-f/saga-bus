import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @google-cloud/pubsub before imports
vi.mock("@google-cloud/pubsub", () => {
  const createMockSubscription = () => {
    const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
    return {
      exists: vi.fn().mockResolvedValue([true]),
      create: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
      }),
      emit: (event: string, ...args: unknown[]) => {
        handlers[event]?.forEach((h) => h(...args));
      },
      __handlers: handlers,
    };
  };

  const createMockTopic = () => ({
    exists: vi.fn().mockResolvedValue([true]),
    create: vi.fn().mockResolvedValue(undefined),
    subscription: vi.fn(() => createMockSubscription()),
    publishMessage: vi.fn().mockResolvedValue("message-id-123"),
  });

  const mockPubSub = {
    topic: vi.fn(() => createMockTopic()),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return {
    PubSub: vi.fn().mockImplementation(() => mockPubSub),
    Topic: vi.fn(),
    Subscription: vi.fn(),
    Message: vi.fn(),
    __mockPubSub: mockPubSub,
    __createMockTopic: createMockTopic,
    __createMockSubscription: createMockSubscription,
  };
});

import { GcpPubSubTransport } from "../src/GcpPubSubTransport.js";
import type { BaseMessage } from "@saga-bus/core";

interface TestMessage extends BaseMessage {
  type: "TestEvent";
  data: string;
}

// Helper to get mock exports with proper typing
async function getMocks() {
  const mod = (await import("@google-cloud/pubsub")) as unknown as {
    PubSub: ReturnType<typeof vi.fn>;
    __mockPubSub: {
      topic: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
    };
    __createMockTopic: () => {
      exists: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      subscription: ReturnType<typeof vi.fn>;
      publishMessage: ReturnType<typeof vi.fn>;
    };
    __createMockSubscription: () => {
      exists: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      on: ReturnType<typeof vi.fn>;
      emit: (event: string, ...args: unknown[]) => void;
      __handlers: Record<string, ((...args: unknown[]) => void)[]>;
    };
  };
  return mod;
}

describe("GcpPubSubTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should throw if no pubsub, clientConfig, or projectId provided", () => {
      expect(() => new GcpPubSubTransport({} as any)).toThrow(
        "Either pubsub, clientConfig, or projectId must be provided"
      );
    });

    it("should accept projectId", () => {
      const transport = new GcpPubSubTransport({ projectId: "my-project" });
      expect(transport).toBeDefined();
    });

    it("should accept clientConfig", () => {
      const transport = new GcpPubSubTransport({
        clientConfig: { projectId: "my-project" },
      });
      expect(transport).toBeDefined();
    });

    it("should accept existing pubsub instance", async () => {
      const { PubSub } = await getMocks();
      const pubsub = new PubSub() as any;
      const transport = new GcpPubSubTransport({ pubsub });
      expect(transport).toBeDefined();
    });
  });

  describe("start/stop", () => {
    it("should create PubSub client on start when using projectId", async () => {
      const { PubSub } = await getMocks();
      const transport = new GcpPubSubTransport({ projectId: "my-project" });
      await transport.start();
      expect(PubSub).toHaveBeenCalledWith({ projectId: "my-project" });
    });

    it("should use provided pubsub instance", async () => {
      const { PubSub, __mockPubSub } = await getMocks();
      const pubsub = __mockPubSub;
      const transport = new GcpPubSubTransport({ pubsub: pubsub as any });
      await transport.start();
      expect(PubSub).not.toHaveBeenCalled();
    });

    it("should be idempotent for start", async () => {
      const { PubSub } = await getMocks();
      const transport = new GcpPubSubTransport({ projectId: "my-project" });
      await transport.start();
      await transport.start();
      expect(PubSub).toHaveBeenCalledTimes(1);
    });

    it("should close client on stop when we created it", async () => {
      const { __mockPubSub } = await getMocks();
      const transport = new GcpPubSubTransport({ projectId: "my-project" });
      await transport.start();
      await transport.stop();
      expect(__mockPubSub.close).toHaveBeenCalled();
    });

    it("should not close client on stop if provided externally", async () => {
      const { __mockPubSub } = await getMocks();
      const transport = new GcpPubSubTransport({
        pubsub: __mockPubSub as any,
      });
      await transport.start();
      await transport.stop();
      expect(__mockPubSub.close).not.toHaveBeenCalled();
    });

    it("should be idempotent for stop", async () => {
      const { __mockPubSub } = await getMocks();
      const transport = new GcpPubSubTransport({ projectId: "my-project" });
      await transport.start();
      await transport.stop();
      await transport.stop();
      expect(__mockPubSub.close).toHaveBeenCalledTimes(1);
    });
  });

  describe("publish", () => {
    it("should throw if not started", async () => {
      const transport = new GcpPubSubTransport({ projectId: "my-project" });
      const message: TestMessage = { type: "TestEvent", data: "test" };

      await expect(
        transport.publish(message, { endpoint: "test-topic" })
      ).rejects.toThrow("Transport not started");
    });

    it("should publish message to topic", async () => {
      const { __mockPubSub, __createMockTopic } = await getMocks();
      const mockTopic = __createMockTopic();
      __mockPubSub.topic.mockReturnValue(mockTopic);

      const transport = new GcpPubSubTransport({ projectId: "my-project" });
      await transport.start();

      const message: TestMessage = { type: "TestEvent", data: "test-data" };
      await transport.publish(message, { endpoint: "test-topic" });

      expect(__mockPubSub.topic).toHaveBeenCalledWith("test-topic");
      expect(mockTopic.publishMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.any(Buffer),
          attributes: expect.objectContaining({
            messageType: "TestEvent",
            messageId: expect.any(String),
          }),
        })
      );
    });

    it("should use defaultTopic if no endpoint provided", async () => {
      const { __mockPubSub, __createMockTopic } = await getMocks();
      const mockTopic = __createMockTopic();
      __mockPubSub.topic.mockReturnValue(mockTopic);

      const transport = new GcpPubSubTransport({
        projectId: "my-project",
        defaultTopic: "default-topic",
      });
      await transport.start();

      const message: TestMessage = { type: "TestEvent", data: "test-data" };
      await transport.publish(message, {});

      expect(__mockPubSub.topic).toHaveBeenCalledWith("default-topic");
    });

    it("should use message type as topic if no endpoint or defaultTopic", async () => {
      const { __mockPubSub, __createMockTopic } = await getMocks();
      const mockTopic = __createMockTopic();
      __mockPubSub.topic.mockReturnValue(mockTopic);

      const transport = new GcpPubSubTransport({ projectId: "my-project" });
      await transport.start();

      const message: TestMessage = { type: "TestEvent", data: "test-data" };
      await transport.publish(message, {});

      expect(__mockPubSub.topic).toHaveBeenCalledWith("TestEvent");
    });

    it("should include ordering key when enabled", async () => {
      const { __mockPubSub, __createMockTopic } = await getMocks();
      const mockTopic = __createMockTopic();
      __mockPubSub.topic.mockReturnValue(mockTopic);

      const transport = new GcpPubSubTransport({
        projectId: "my-project",
        enableOrdering: true,
      });
      await transport.start();

      const message: TestMessage = { type: "TestEvent", data: "test-data" };
      await transport.publish(message, { endpoint: "test-topic", key: "order-123" });

      expect(mockTopic.publishMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          orderingKey: "order-123",
          attributes: expect.objectContaining({
            correlationId: "order-123",
          }),
        })
      );
    });

    it("should throw on delayed messages", async () => {
      const transport = new GcpPubSubTransport({ projectId: "my-project" });
      await transport.start();

      const message: TestMessage = { type: "TestEvent", data: "test-data" };

      await expect(
        transport.publish(message, { endpoint: "test-topic", delayMs: 5000 })
      ).rejects.toThrow("GCP Pub/Sub does not support delayed messages");
    });

    it("should auto-create topic if not exists", async () => {
      const { __mockPubSub, __createMockTopic } = await getMocks();
      const mockTopic = __createMockTopic();
      mockTopic.exists.mockResolvedValue([false]);
      __mockPubSub.topic.mockReturnValue(mockTopic);

      const transport = new GcpPubSubTransport({
        projectId: "my-project",
        autoCreate: true,
      });
      await transport.start();

      const message: TestMessage = { type: "TestEvent", data: "test-data" };
      await transport.publish(message, { endpoint: "new-topic" });

      expect(mockTopic.create).toHaveBeenCalled();
    });

    it("should not auto-create topic if disabled", async () => {
      const { __mockPubSub, __createMockTopic } = await getMocks();
      const mockTopic = __createMockTopic();
      mockTopic.exists.mockResolvedValue([true]);
      __mockPubSub.topic.mockReturnValue(mockTopic);

      const transport = new GcpPubSubTransport({
        projectId: "my-project",
        autoCreate: false,
      });
      await transport.start();

      const message: TestMessage = { type: "TestEvent", data: "test-data" };
      await transport.publish(message, { endpoint: "existing-topic" });

      expect(mockTopic.exists).not.toHaveBeenCalled();
      expect(mockTopic.create).not.toHaveBeenCalled();
    });

    it("should add custom headers as attributes", async () => {
      const { __mockPubSub, __createMockTopic } = await getMocks();
      const mockTopic = __createMockTopic();
      __mockPubSub.topic.mockReturnValue(mockTopic);

      const transport = new GcpPubSubTransport({ projectId: "my-project" });
      await transport.start();

      const message: TestMessage = { type: "TestEvent", data: "test-data" };
      await transport.publish(message, {
        endpoint: "test-topic",
        headers: { customHeader: "customValue" },
      });

      expect(mockTopic.publishMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.objectContaining({
            customHeader: "customValue",
          }),
        })
      );
    });
  });

  describe("subscribe", () => {
    it("should throw if not started", async () => {
      const transport = new GcpPubSubTransport({ projectId: "my-project" });

      await expect(
        transport.subscribe({ endpoint: "test-topic" }, vi.fn())
      ).rejects.toThrow("Transport not started");
    });

    it("should create subscription and listen for messages", async () => {
      const { __mockPubSub, __createMockTopic, __createMockSubscription } =
        await getMocks();
      const mockTopic = __createMockTopic();
      const mockSubscription = __createMockSubscription();
      mockTopic.subscription.mockReturnValue(mockSubscription);
      __mockPubSub.topic.mockReturnValue(mockTopic);

      const transport = new GcpPubSubTransport({ projectId: "my-project" });
      await transport.start();

      const handler = vi.fn().mockResolvedValue(undefined);
      await transport.subscribe({ endpoint: "test-topic" }, handler);

      expect(__mockPubSub.topic).toHaveBeenCalledWith("test-topic");
      expect(mockTopic.subscription).toHaveBeenCalledWith(
        "saga-bus-test-topic"
      );
      expect(mockSubscription.on).toHaveBeenCalledWith(
        "message",
        expect.any(Function)
      );
      expect(mockSubscription.on).toHaveBeenCalledWith(
        "error",
        expect.any(Function)
      );
    });

    it("should use custom group name as subscription", async () => {
      const { __mockPubSub, __createMockTopic, __createMockSubscription } =
        await getMocks();
      const mockTopic = __createMockTopic();
      const mockSubscription = __createMockSubscription();
      mockTopic.subscription.mockReturnValue(mockSubscription);
      __mockPubSub.topic.mockReturnValue(mockTopic);

      const transport = new GcpPubSubTransport({ projectId: "my-project" });
      await transport.start();

      await transport.subscribe(
        { endpoint: "test-topic", group: "custom-subscription" },
        vi.fn()
      );

      expect(mockTopic.subscription).toHaveBeenCalledWith("custom-subscription");
    });

    it("should handle incoming messages and ack on success", async () => {
      const { __mockPubSub, __createMockTopic, __createMockSubscription } =
        await getMocks();
      const mockTopic = __createMockTopic();
      const mockSubscription = __createMockSubscription();
      mockTopic.subscription.mockReturnValue(mockSubscription);
      __mockPubSub.topic.mockReturnValue(mockTopic);

      const transport = new GcpPubSubTransport({ projectId: "my-project" });
      await transport.start();

      const handler = vi.fn().mockResolvedValue(undefined);
      await transport.subscribe({ endpoint: "test-topic" }, handler);

      // Simulate incoming message
      const testEnvelope = {
        id: "msg-123",
        type: "TestEvent",
        payload: { type: "TestEvent", data: "test-data" },
        headers: {},
        timestamp: new Date().toISOString(),
        partitionKey: "key-1",
      };

      const mockMessage = {
        data: Buffer.from(JSON.stringify(testEnvelope)),
        ack: vi.fn(),
        nack: vi.fn(),
      };

      // Trigger message handler
      mockSubscription.emit("message", mockMessage);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "msg-123",
          type: "TestEvent",
          payload: expect.objectContaining({ type: "TestEvent" }),
        })
      );
      expect(mockMessage.ack).toHaveBeenCalled();
      expect(mockMessage.nack).not.toHaveBeenCalled();
    });

    it("should nack message on handler error", async () => {
      const { __mockPubSub, __createMockTopic, __createMockSubscription } =
        await getMocks();
      const mockTopic = __createMockTopic();
      const mockSubscription = __createMockSubscription();
      mockTopic.subscription.mockReturnValue(mockSubscription);
      __mockPubSub.topic.mockReturnValue(mockTopic);

      const transport = new GcpPubSubTransport({ projectId: "my-project" });
      await transport.start();

      const handler = vi.fn().mockRejectedValue(new Error("Handler failed"));
      await transport.subscribe({ endpoint: "test-topic" }, handler);

      const testEnvelope = {
        id: "msg-123",
        type: "TestEvent",
        payload: { type: "TestEvent", data: "test-data" },
        headers: {},
        timestamp: new Date().toISOString(),
      };

      const mockMessage = {
        data: Buffer.from(JSON.stringify(testEnvelope)),
        ack: vi.fn(),
        nack: vi.fn(),
      };

      mockSubscription.emit("message", mockMessage);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockMessage.nack).toHaveBeenCalled();
      expect(mockMessage.ack).not.toHaveBeenCalled();
    });

    it("should auto-create subscription if not exists", async () => {
      const { __mockPubSub, __createMockTopic, __createMockSubscription } =
        await getMocks();
      const mockTopic = __createMockTopic();
      const mockSubscription = __createMockSubscription();
      mockSubscription.exists.mockResolvedValue([false]);
      mockTopic.subscription.mockReturnValue(mockSubscription);
      __mockPubSub.topic.mockReturnValue(mockTopic);

      const transport = new GcpPubSubTransport({
        projectId: "my-project",
        autoCreate: true,
        enableOrdering: true,
        ackDeadlineSeconds: 120,
      });
      await transport.start();

      await transport.subscribe({ endpoint: "test-topic" }, vi.fn());

      expect(mockSubscription.create).toHaveBeenCalledWith({
        enableMessageOrdering: true,
        ackDeadlineSeconds: 120,
      });
    });

    it("should close subscriptions on stop", async () => {
      const { __mockPubSub, __createMockTopic, __createMockSubscription } =
        await getMocks();
      const mockTopic = __createMockTopic();
      const mockSubscription = __createMockSubscription();
      mockTopic.subscription.mockReturnValue(mockSubscription);
      __mockPubSub.topic.mockReturnValue(mockTopic);

      const transport = new GcpPubSubTransport({ projectId: "my-project" });
      await transport.start();

      await transport.subscribe({ endpoint: "test-topic" }, vi.fn());
      await transport.stop();

      expect(mockSubscription.close).toHaveBeenCalled();
    });
  });
});
