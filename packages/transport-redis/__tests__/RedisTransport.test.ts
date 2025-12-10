import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedisTransport } from "../src/RedisTransport.js";

// Mock ioredis before any imports
vi.mock("ioredis", () => {
  const mockRedis = {
    duplicate: vi.fn(),
    quit: vi.fn().mockResolvedValue("OK"),
    xgroup: vi.fn().mockResolvedValue("OK"),
    xadd: vi.fn().mockResolvedValue("1234567890-0"),
    xreadgroup: vi.fn().mockResolvedValue(null),
    xack: vi.fn().mockResolvedValue(1),
    xpending: vi.fn().mockResolvedValue([]),
    xclaim: vi.fn().mockResolvedValue([]),
    zadd: vi.fn().mockResolvedValue(1),
    zrangebyscore: vi.fn().mockResolvedValue([]),
    zrem: vi.fn().mockResolvedValue(1),
  };

  // duplicate returns a copy of the mock
  mockRedis.duplicate.mockReturnValue({
    ...mockRedis,
    duplicate: vi.fn().mockReturnThis(),
  });

  return {
    Redis: vi.fn().mockImplementation(() => mockRedis),
    default: vi.fn().mockImplementation(() => mockRedis),
    __mockRedis: mockRedis,
  };
});

function createMessage(type: string, payload: unknown): { type: string; payload: unknown } {
  return { type, payload };
}

describe("RedisTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should throw error if neither redis nor connection provided", () => {
      expect(
        () =>
          new RedisTransport({
            consumerGroup: "test-group",
          })
      ).toThrow("Either redis client or connection options must be provided");
    });

    it("should accept connection options", () => {
      const transport = new RedisTransport({
        connection: { host: "localhost", port: 6379 },
        consumerGroup: "test-group",
      });
      expect(transport).toBeInstanceOf(RedisTransport);
    });
  });

  describe("start", () => {
    it("should be idempotent", async () => {
      const { Redis } = await import("ioredis");

      const transport = new RedisTransport({
        connection: { host: "localhost" },
        consumerGroup: "test-group",
        delayedPollIntervalMs: 0,
        pendingClaimIntervalMs: 0,
      });

      await transport.start();
      await transport.start(); // Should not throw

      // Redis constructor should only be called twice (main + subscriber)
      expect(Redis).toHaveBeenCalledTimes(2);

      await transport.stop();
    });

    it("should create consumer groups for subscribed streams", async () => {
      const { __mockRedis } = (await import("ioredis")) as unknown as {
        __mockRedis: { xgroup: ReturnType<typeof vi.fn> };
      };

      const transport = new RedisTransport({
        connection: { host: "localhost" },
        consumerGroup: "test-group",
        autoCreateGroup: true,
        delayedPollIntervalMs: 0,
        pendingClaimIntervalMs: 0,
      });

      await transport.subscribe(
        { endpoint: "test-endpoint" },
        async () => {}
      );

      await transport.start();

      expect(__mockRedis.xgroup).toHaveBeenCalledWith(
        "CREATE",
        "saga-bus:stream:test-endpoint",
        "test-group",
        "0",
        "MKSTREAM"
      );

      await transport.stop();
    });
  });

  describe("stop", () => {
    it("should close connections", async () => {
      const { __mockRedis } = (await import("ioredis")) as unknown as {
        __mockRedis: { quit: ReturnType<typeof vi.fn> };
      };

      const transport = new RedisTransport({
        connection: { host: "localhost" },
        consumerGroup: "test-group",
        delayedPollIntervalMs: 0,
        pendingClaimIntervalMs: 0,
      });

      await transport.start();
      await transport.stop();

      expect(__mockRedis.quit).toHaveBeenCalled();
    });

    it("should be idempotent", async () => {
      const transport = new RedisTransport({
        connection: { host: "localhost" },
        consumerGroup: "test-group",
        delayedPollIntervalMs: 0,
        pendingClaimIntervalMs: 0,
      });

      await transport.start();
      await transport.stop();
      await transport.stop(); // Should not throw
    });
  });

  describe("subscribe", () => {
    it("should register subscription", async () => {
      const { __mockRedis } = (await import("ioredis")) as unknown as {
        __mockRedis: { xgroup: ReturnType<typeof vi.fn> };
      };

      const transport = new RedisTransport({
        connection: { host: "localhost" },
        consumerGroup: "test-group",
        delayedPollIntervalMs: 0,
        pendingClaimIntervalMs: 0,
      });

      const handler = vi.fn();
      await transport.subscribe({ endpoint: "orders" }, handler);

      // Subscription is registered (start will create consumer group)
      await transport.start();

      expect(__mockRedis.xgroup).toHaveBeenCalledWith(
        "CREATE",
        "saga-bus:stream:orders",
        "test-group",
        "0",
        "MKSTREAM"
      );

      await transport.stop();
    });

    it("should use custom key prefix", async () => {
      const { __mockRedis } = (await import("ioredis")) as unknown as {
        __mockRedis: { xgroup: ReturnType<typeof vi.fn> };
      };

      const transport = new RedisTransport({
        connection: { host: "localhost" },
        consumerGroup: "test-group",
        keyPrefix: "myapp:",
        delayedPollIntervalMs: 0,
        pendingClaimIntervalMs: 0,
      });

      await transport.subscribe({ endpoint: "events" }, async () => {});
      await transport.start();

      expect(__mockRedis.xgroup).toHaveBeenCalledWith(
        "CREATE",
        "myapp:stream:events",
        "test-group",
        "0",
        "MKSTREAM"
      );

      await transport.stop();
    });
  });

  describe("publish", () => {
    it("should throw if not started", async () => {
      const transport = new RedisTransport({
        connection: { host: "localhost" },
        consumerGroup: "test-group",
      });

      await expect(
        transport.publish(createMessage("Test", {}) as never, {
          endpoint: "test",
        })
      ).rejects.toThrow("Transport not started");
    });

    it("should add message to stream", async () => {
      const { __mockRedis } = (await import("ioredis")) as unknown as {
        __mockRedis: { xadd: ReturnType<typeof vi.fn> };
      };

      const transport = new RedisTransport({
        connection: { host: "localhost" },
        consumerGroup: "test-group",
        delayedPollIntervalMs: 0,
        pendingClaimIntervalMs: 0,
      });

      await transport.start();

      const message = createMessage("OrderCreated", { orderId: "123" });
      await transport.publish(message as never, { endpoint: "orders" });

      expect(__mockRedis.xadd).toHaveBeenCalledWith(
        "saga-bus:stream:orders",
        "*",
        "data",
        expect.stringContaining("OrderCreated")
      );

      await transport.stop();
    });

    it("should include partition key in envelope", async () => {
      const { __mockRedis } = (await import("ioredis")) as unknown as {
        __mockRedis: { xadd: ReturnType<typeof vi.fn> };
      };

      const transport = new RedisTransport({
        connection: { host: "localhost" },
        consumerGroup: "test-group",
        delayedPollIntervalMs: 0,
        pendingClaimIntervalMs: 0,
      });

      await transport.start();

      const message = createMessage("OrderCreated", { orderId: "123" });
      await transport.publish(message as never, {
        endpoint: "orders",
        key: "order-123",
      });

      const xaddCall = __mockRedis.xadd.mock.calls[0];
      const envelopeJson = xaddCall[xaddCall.length - 1] as string;
      const envelope = JSON.parse(envelopeJson);

      expect(envelope.partitionKey).toBe("order-123");

      await transport.stop();
    });

    it("should include headers in envelope", async () => {
      const { __mockRedis } = (await import("ioredis")) as unknown as {
        __mockRedis: { xadd: ReturnType<typeof vi.fn> };
      };

      const transport = new RedisTransport({
        connection: { host: "localhost" },
        consumerGroup: "test-group",
        delayedPollIntervalMs: 0,
        pendingClaimIntervalMs: 0,
      });

      await transport.start();

      const message = createMessage("OrderCreated", { orderId: "123" });
      await transport.publish(message as never, {
        endpoint: "orders",
        headers: { "x-tenant-id": "tenant-1" },
      });

      const xaddCall = __mockRedis.xadd.mock.calls[0];
      const envelopeJson = xaddCall[xaddCall.length - 1] as string;
      const envelope = JSON.parse(envelopeJson);

      expect(envelope.headers).toEqual({ "x-tenant-id": "tenant-1" });

      await transport.stop();
    });

    it("should use MAXLEN when configured", async () => {
      const { __mockRedis } = (await import("ioredis")) as unknown as {
        __mockRedis: { xadd: ReturnType<typeof vi.fn> };
      };

      const transport = new RedisTransport({
        connection: { host: "localhost" },
        consumerGroup: "test-group",
        maxStreamLength: 1000,
        approximateMaxLen: true,
        delayedPollIntervalMs: 0,
        pendingClaimIntervalMs: 0,
      });

      await transport.start();

      const message = createMessage("Test", {});
      await transport.publish(message as never, { endpoint: "test" });

      expect(__mockRedis.xadd).toHaveBeenCalledWith(
        "saga-bus:stream:test",
        "MAXLEN",
        "~",
        1000,
        "*",
        "data",
        expect.any(String)
      );

      await transport.stop();
    });

    it("should store delayed messages in sorted set", async () => {
      const { __mockRedis } = (await import("ioredis")) as unknown as {
        __mockRedis: {
          xadd: ReturnType<typeof vi.fn>;
          zadd: ReturnType<typeof vi.fn>;
        };
      };

      const transport = new RedisTransport({
        connection: { host: "localhost" },
        consumerGroup: "test-group",
        delayedPollIntervalMs: 0,
        pendingClaimIntervalMs: 0,
      });

      await transport.start();

      const message = createMessage("DelayedEvent", { value: 42 });
      await transport.publish(message as never, {
        endpoint: "events",
        delayMs: 5000,
      });

      // Should NOT add to stream
      expect(__mockRedis.xadd).not.toHaveBeenCalled();

      // Should add to delayed set
      expect(__mockRedis.zadd).toHaveBeenCalledWith(
        "saga-bus:delayed",
        expect.any(Number), // delivery timestamp
        expect.stringContaining("DelayedEvent")
      );

      await transport.stop();
    });
  });

  describe("consumer group error handling", () => {
    it("should ignore BUSYGROUP error", async () => {
      const { __mockRedis } = (await import("ioredis")) as unknown as {
        __mockRedis: { xgroup: ReturnType<typeof vi.fn> };
      };

      const busyGroupError = new Error("BUSYGROUP Consumer Group name already exists");
      __mockRedis.xgroup.mockRejectedValueOnce(busyGroupError);

      const transport = new RedisTransport({
        connection: { host: "localhost" },
        consumerGroup: "test-group",
        delayedPollIntervalMs: 0,
        pendingClaimIntervalMs: 0,
      });

      await transport.subscribe({ endpoint: "test" }, async () => {});

      // Should not throw
      await expect(transport.start()).resolves.toBeUndefined();

      await transport.stop();
    });

    it("should throw non-BUSYGROUP errors", async () => {
      const { __mockRedis } = (await import("ioredis")) as unknown as {
        __mockRedis: { xgroup: ReturnType<typeof vi.fn> };
      };

      const otherError = new Error("Connection refused");
      __mockRedis.xgroup.mockRejectedValueOnce(otherError);

      const transport = new RedisTransport({
        connection: { host: "localhost" },
        consumerGroup: "test-group",
        delayedPollIntervalMs: 0,
        pendingClaimIntervalMs: 0,
      });

      await transport.subscribe({ endpoint: "test" }, async () => {});

      await expect(transport.start()).rejects.toThrow("Connection refused");
    });
  });
});
