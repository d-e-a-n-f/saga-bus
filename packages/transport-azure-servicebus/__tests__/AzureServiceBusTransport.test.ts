import { describe, it, expect, vi, beforeEach } from "vitest";
import { AzureServiceBusTransport } from "../src/AzureServiceBusTransport.js";

// Mock @azure/service-bus
vi.mock("@azure/service-bus", () => {
  const mockSender = {
    sendMessages: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockReceiver = {
    subscribe: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    completeMessage: vi.fn().mockResolvedValue(undefined),
    abandonMessage: vi.fn().mockResolvedValue(undefined),
    deadLetterMessage: vi.fn().mockResolvedValue(undefined),
  };

  const mockClient = {
    createSender: vi.fn().mockReturnValue(mockSender),
    createReceiver: vi.fn().mockReturnValue(mockReceiver),
    acceptNextSession: vi.fn().mockResolvedValue(mockReceiver),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return {
    ServiceBusClient: vi.fn().mockImplementation(() => mockClient),
    __mockClient: mockClient,
    __mockSender: mockSender,
    __mockReceiver: mockReceiver,
  };
});

// Helper to get mock exports with proper typing
async function getMocks() {
  const mod = (await import("@azure/service-bus")) as unknown as {
    ServiceBusClient: ReturnType<typeof vi.fn>;
    __mockClient: {
      createSender: ReturnType<typeof vi.fn>;
      createReceiver: ReturnType<typeof vi.fn>;
      acceptNextSession: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
    };
    __mockSender: {
      sendMessages: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
    };
    __mockReceiver: {
      subscribe: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
    };
  };
  return mod;
}

describe("AzureServiceBusTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should require connectionString or fullyQualifiedNamespace", () => {
      expect(() => new AzureServiceBusTransport({} as never)).toThrow(
        "Either connectionString or fullyQualifiedNamespace must be provided"
      );
    });

    it("should require credential with fullyQualifiedNamespace", () => {
      expect(
        () =>
          new AzureServiceBusTransport({
            fullyQualifiedNamespace: "mybus.servicebus.windows.net",
          } as never)
      ).toThrow("credential is required when using fullyQualifiedNamespace");
    });

    it("should accept connectionString", () => {
      const transport = new AzureServiceBusTransport({
        connectionString: "Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test",
      });
      expect(transport).toBeDefined();
    });

    it("should accept fullyQualifiedNamespace with credential", () => {
      const mockCredential = { getToken: vi.fn() };
      const transport = new AzureServiceBusTransport({
        fullyQualifiedNamespace: "mybus.servicebus.windows.net",
        credential: mockCredential as never,
      });
      expect(transport).toBeDefined();
    });
  });

  describe("start", () => {
    it("should create ServiceBusClient with connectionString", async () => {
      const { ServiceBusClient } = await getMocks();

      const transport = new AzureServiceBusTransport({
        connectionString: "Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test",
      });

      await transport.start();

      expect(ServiceBusClient).toHaveBeenCalledWith(
        "Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test"
      );
    });

    it("should be idempotent", async () => {
      const { ServiceBusClient } = await getMocks();

      const transport = new AzureServiceBusTransport({
        connectionString: "Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test",
      });

      await transport.start();
      await transport.start();

      expect(ServiceBusClient).toHaveBeenCalledTimes(1);
    });
  });

  describe("stop", () => {
    it("should close client and clear state", async () => {
      const { __mockClient } = await getMocks();

      const transport = new AzureServiceBusTransport({
        connectionString: "Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test",
      });

      await transport.start();
      await transport.stop();

      expect(__mockClient.close).toHaveBeenCalled();
    });
  });

  describe("publish", () => {
    it("should throw if not started", async () => {
      const transport = new AzureServiceBusTransport({
        connectionString: "Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test",
      });

      await expect(
        transport.publish({ type: "TestMessage" }, { endpoint: "test-topic" })
      ).rejects.toThrow("Transport not started");
    });

    it("should publish message to sender", async () => {
      const { __mockClient, __mockSender } = await getMocks();

      const transport = new AzureServiceBusTransport({
        connectionString: "Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test",
      });

      await transport.start();
      await transport.publish({ type: "TestMessage" }, { endpoint: "test-topic" });

      expect(__mockClient.createSender).toHaveBeenCalledWith("test-topic");
      expect(__mockSender.sendMessages).toHaveBeenCalled();

      const sentMessage = __mockSender.sendMessages.mock.calls[0][0];
      expect(sentMessage.body.type).toBe("TestMessage");
      expect(sentMessage.contentType).toBe("application/json");
    });

    it("should use defaultTopic when endpoint not provided", async () => {
      const { __mockClient } = await getMocks();

      const transport = new AzureServiceBusTransport({
        connectionString: "Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test",
        defaultTopic: "default-topic",
      });

      await transport.start();
      await transport.publish({ type: "TestMessage" }, {} as never);

      expect(__mockClient.createSender).toHaveBeenCalledWith("default-topic");
    });

    it("should apply entity prefix", async () => {
      const { __mockClient } = await getMocks();

      const transport = new AzureServiceBusTransport({
        connectionString: "Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test",
        entityPrefix: "saga-",
      });

      await transport.start();
      await transport.publish({ type: "TestMessage" }, { endpoint: "orders" });

      expect(__mockClient.createSender).toHaveBeenCalledWith("saga-orders");
    });

    it("should set scheduledEnqueueTimeUtc for delayed messages", async () => {
      const { __mockSender } = await getMocks();

      const transport = new AzureServiceBusTransport({
        connectionString: "Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test",
      });

      await transport.start();

      const beforePublish = Date.now();
      await transport.publish(
        { type: "TestMessage" },
        { endpoint: "test-topic", delayMs: 60000 }
      );

      const sentMessage = __mockSender.sendMessages.mock.calls[0][0];
      expect(sentMessage.scheduledEnqueueTimeUtc).toBeDefined();
      expect(sentMessage.scheduledEnqueueTimeUtc.getTime()).toBeGreaterThanOrEqual(
        beforePublish + 60000
      );
    });

    it("should set sessionId when sessionEnabled and key provided", async () => {
      const { __mockSender } = await getMocks();

      const transport = new AzureServiceBusTransport({
        connectionString: "Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test",
        sessionEnabled: true,
      });

      await transport.start();
      await transport.publish(
        { type: "TestMessage" },
        { endpoint: "test-topic", key: "order-123" }
      );

      const sentMessage = __mockSender.sendMessages.mock.calls[0][0];
      expect(sentMessage.sessionId).toBe("order-123");
    });

    it("should set partitionKey when sessionEnabled is false", async () => {
      const { __mockSender } = await getMocks();

      const transport = new AzureServiceBusTransport({
        connectionString: "Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test",
        sessionEnabled: false,
      });

      await transport.start();
      await transport.publish(
        { type: "TestMessage" },
        { endpoint: "test-topic", key: "order-123" }
      );

      const sentMessage = __mockSender.sendMessages.mock.calls[0][0];
      expect(sentMessage.partitionKey).toBe("order-123");
      expect(sentMessage.sessionId).toBeUndefined();
    });
  });

  describe("subscribe", () => {
    it("should register subscription", async () => {
      const transport = new AzureServiceBusTransport({
        connectionString: "Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test",
        subscriptionName: "my-subscription",
      });

      const handler = vi.fn();
      await transport.subscribe({ endpoint: "test-topic" }, handler);

      // Subscription is stored but receiver not created until start()
      expect(handler).not.toHaveBeenCalled();
    });

    it("should start receiver on start() for registered subscriptions", async () => {
      const { __mockClient } = await getMocks();

      const transport = new AzureServiceBusTransport({
        connectionString: "Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test",
        subscriptionName: "my-subscription",
      });

      const handler = vi.fn();
      await transport.subscribe({ endpoint: "test-topic" }, handler);
      await transport.start();

      expect(__mockClient.createReceiver).toHaveBeenCalledWith(
        "test-topic",
        "my-subscription",
        expect.any(Object)
      );
    });

    it("should use group as subscription name when provided", async () => {
      const { __mockClient } = await getMocks();

      const transport = new AzureServiceBusTransport({
        connectionString: "Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test",
        subscriptionName: "default-subscription",
      });

      const handler = vi.fn();
      await transport.subscribe(
        { endpoint: "test-topic", group: "custom-subscription" },
        handler
      );
      await transport.start();

      expect(__mockClient.createReceiver).toHaveBeenCalledWith(
        "test-topic",
        "custom-subscription",
        expect.any(Object)
      );
    });

    it("should use acceptNextSession when sessionEnabled", async () => {
      const { __mockClient } = await getMocks();

      const transport = new AzureServiceBusTransport({
        connectionString: "Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=test",
        subscriptionName: "my-subscription",
        sessionEnabled: true,
      });

      const handler = vi.fn();
      await transport.subscribe({ endpoint: "test-topic" }, handler);
      await transport.start();

      expect(__mockClient.acceptNextSession).toHaveBeenCalledWith(
        "test-topic",
        "my-subscription",
        expect.any(Object)
      );
      expect(__mockClient.createReceiver).not.toHaveBeenCalled();
    });
  });
});
