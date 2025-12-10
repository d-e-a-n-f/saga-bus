import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock ioredis before imports
vi.mock("ioredis", () => {
  const createMockMulti = () => {
    const commands: Array<{ cmd: string; args: unknown[] }> = [];
    return {
      set: vi.fn((...args: unknown[]) => {
        commands.push({ cmd: "set", args });
        return createMockMulti();
      }),
      setex: vi.fn((...args: unknown[]) => {
        commands.push({ cmd: "setex", args });
        return createMockMulti();
      }),
      exec: vi.fn().mockResolvedValue([["OK"], ["OK"]]),
      __commands: commands,
    };
  };

  const mockRedis = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    watch: vi.fn().mockResolvedValue("OK"),
    unwatch: vi.fn().mockResolvedValue("OK"),
    multi: vi.fn(() => createMockMulti()),
    quit: vi.fn().mockResolvedValue("OK"),
  };

  return {
    Redis: vi.fn().mockImplementation(() => mockRedis),
    default: vi.fn().mockImplementation(() => mockRedis),
    __mockRedis: mockRedis,
    __createMockMulti: createMockMulti,
  };
});

import { RedisSagaStore } from "../src/RedisSagaStore.js";
import type { SagaState, SagaStateMetadata } from "@saga-bus/core";

interface TestData {
  orderId: string;
  amount: number;
}

interface TestState extends SagaState {
  orderId: string;
  amount: number;
  metadata: SagaStateMetadata;
}

function createTestState(
  overrides: Partial<TestState> = {}
): TestState {
  return {
    orderId: "order-456",
    amount: 100,
    metadata: {
      sagaId: "saga-123",
      version: 1,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
      isCompleted: false,
      archivedAt: null,
      traceParent: null,
      traceState: null,
      timeoutMs: null,
      timeoutExpiresAt: null,
    },
    ...overrides,
  };
}

// Helper to get mock exports with proper typing
async function getMocks() {
  const mod = (await import("ioredis")) as unknown as {
    Redis: ReturnType<typeof vi.fn>;
    __mockRedis: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      setex: ReturnType<typeof vi.fn>;
      del: ReturnType<typeof vi.fn>;
      watch: ReturnType<typeof vi.fn>;
      unwatch: ReturnType<typeof vi.fn>;
      multi: ReturnType<typeof vi.fn>;
      quit: ReturnType<typeof vi.fn>;
    };
    __createMockMulti: () => {
      set: ReturnType<typeof vi.fn>;
      setex: ReturnType<typeof vi.fn>;
      exec: ReturnType<typeof vi.fn>;
      __commands: Array<{ cmd: string; args: unknown[] }>;
    };
  };
  return mod;
}

describe("RedisSagaStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should throw if no redis or connection provided", () => {
      expect(() => new RedisSagaStore({} as any)).toThrow(
        "Either redis or connection must be provided"
      );
    });

    it("should accept connection options", () => {
      const store = new RedisSagaStore({
        connection: { host: "localhost", port: 6379 },
      });
      expect(store).toBeDefined();
    });

    it("should accept existing redis instance", async () => {
      const { __mockRedis } = await getMocks();
      const store = new RedisSagaStore({
        redis: __mockRedis as any,
      });
      expect(store).toBeDefined();
    });
  });

  describe("initialize/close", () => {
    it("should create Redis client on initialize when using connection", async () => {
      const { Redis } = await getMocks();
      const store = new RedisSagaStore({
        connection: { host: "localhost", port: 6379 },
      });
      await store.initialize();
      expect(Redis).toHaveBeenCalledWith({ host: "localhost", port: 6379 });
    });

    it("should use provided redis instance", async () => {
      const { Redis, __mockRedis } = await getMocks();
      const store = new RedisSagaStore({
        redis: __mockRedis as any,
      });
      await store.initialize();
      expect(Redis).not.toHaveBeenCalled();
    });

    it("should quit redis on close when we created it", async () => {
      const { __mockRedis } = await getMocks();
      const store = new RedisSagaStore({
        connection: { host: "localhost", port: 6379 },
      });
      await store.initialize();
      await store.close();
      expect(__mockRedis.quit).toHaveBeenCalled();
    });

    it("should not quit redis on close if provided externally", async () => {
      const { __mockRedis } = await getMocks();
      const store = new RedisSagaStore({
        redis: __mockRedis as any,
      });
      await store.initialize();
      await store.close();
      expect(__mockRedis.quit).not.toHaveBeenCalled();
    });
  });

  describe("getByCorrelationId", () => {
    it("should throw if not initialized", async () => {
      const store = new RedisSagaStore({
        connection: { host: "localhost", port: 6379 },
      });

      await expect(
        store.getByCorrelationId("OrderSaga", "order-123")
      ).rejects.toThrow("Store not initialized");
    });

    it("should return null if not found", async () => {
      const { __mockRedis } = await getMocks();
      __mockRedis.get.mockResolvedValue(null);

      const store = new RedisSagaStore<TestState>({
        connection: { host: "localhost", port: 6379 },
      });
      await store.initialize();

      const result = await store.getByCorrelationId("OrderSaga", "order-123");
      expect(result).toBeNull();
      expect(__mockRedis.get).toHaveBeenCalledWith(
        "saga-bus:saga:OrderSaga:order-123"
      );
    });

    it("should return deserialized state if found", async () => {
      const { __mockRedis } = await getMocks();
      const testState = createTestState();
      __mockRedis.get.mockResolvedValue(
        JSON.stringify({
          ...testState,
          metadata: {
            ...testState.metadata,
            createdAt: testState.metadata.createdAt.toISOString(),
            updatedAt: testState.metadata.updatedAt.toISOString(),
          },
        })
      );

      const store = new RedisSagaStore<TestState>({
        connection: { host: "localhost", port: 6379 },
      });
      await store.initialize();

      const result = await store.getByCorrelationId("OrderSaga", "order-456");
      expect(result).not.toBeNull();
      expect(result?.metadata.sagaId).toBe("saga-123");
      expect(result?.metadata.createdAt).toBeInstanceOf(Date);
    });

    it("should use custom key prefix", async () => {
      const { __mockRedis } = await getMocks();

      const store = new RedisSagaStore<TestState>({
        connection: { host: "localhost", port: 6379 },
        keyPrefix: "myapp:",
      });
      await store.initialize();

      await store.getByCorrelationId("OrderSaga", "order-123");
      expect(__mockRedis.get).toHaveBeenCalledWith(
        "myapp:saga:OrderSaga:order-123"
      );
    });
  });

  describe("getById", () => {
    it("should return null if index not found", async () => {
      const { __mockRedis } = await getMocks();
      __mockRedis.get.mockResolvedValue(null);

      const store = new RedisSagaStore<TestState>({
        connection: { host: "localhost", port: 6379 },
      });
      await store.initialize();

      const result = await store.getById("OrderSaga", "saga-123");
      expect(result).toBeNull();
      expect(__mockRedis.get).toHaveBeenCalledWith(
        "saga-bus:saga:OrderSaga:idx:id:saga-123"
      );
    });

    it("should lookup by correlation ID after finding in index", async () => {
      const { __mockRedis } = await getMocks();
      const testState = createTestState();

      // First call is index lookup, second is actual state
      __mockRedis.get
        .mockResolvedValueOnce("order-456")
        .mockResolvedValueOnce(
          JSON.stringify({
            ...testState,
            metadata: {
              ...testState.metadata,
              createdAt: testState.metadata.createdAt.toISOString(),
              updatedAt: testState.metadata.updatedAt.toISOString(),
            },
          })
        );

      const store = new RedisSagaStore<TestState>({
        connection: { host: "localhost", port: 6379 },
      });
      await store.initialize();

      const result = await store.getById("OrderSaga", "saga-123");
      expect(result).not.toBeNull();
      expect(result?.metadata.sagaId).toBe("saga-123");
      expect(__mockRedis.get).toHaveBeenCalledTimes(2);
    });
  });

  describe("insert", () => {
    it("should throw if not initialized", async () => {
      const store = new RedisSagaStore<TestState>({
        connection: { host: "localhost", port: 6379 },
      });

      await expect(
        store.insert("OrderSaga", "order-456", createTestState())
      ).rejects.toThrow("Store not initialized");
    });

    it("should insert state with multi transaction", async () => {
      const { __mockRedis } = await getMocks();

      const store = new RedisSagaStore<TestState>({
        connection: { host: "localhost", port: 6379 },
      });
      await store.initialize();

      const state = createTestState();
      await store.insert("OrderSaga", "order-456", state);

      expect(__mockRedis.multi).toHaveBeenCalled();
    });

    it("should throw if saga already exists", async () => {
      const { __mockRedis } = await getMocks();
      __mockRedis.get.mockResolvedValue("existing data");

      const store = new RedisSagaStore<TestState>({
        connection: { host: "localhost", port: 6379 },
      });
      await store.initialize();

      const state = createTestState();
      await expect(
        store.insert("OrderSaga", "order-456", state)
      ).rejects.toThrow("already exists");
    });

    it("should use TTL for completed sagas", async () => {
      const { __mockRedis, __createMockMulti } = await getMocks();
      // Reset mock to return null for existence check
      __mockRedis.get.mockResolvedValue(null);
      const mockMulti = __createMockMulti();
      __mockRedis.multi.mockReturnValue(mockMulti);

      const store = new RedisSagaStore<TestState>({
        connection: { host: "localhost", port: 6379 },
        completedTtlSeconds: 3600,
      });
      await store.initialize();

      const state = createTestState({
        metadata: { ...createTestState().metadata, isCompleted: true },
      });
      await store.insert("OrderSaga", "order-456", state);

      expect(mockMulti.setex).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should throw if not initialized", async () => {
      const store = new RedisSagaStore<TestState>({
        connection: { host: "localhost", port: 6379 },
      });

      await expect(
        store.update("OrderSaga", createTestState(), 0)
      ).rejects.toThrow("Store not initialized");
    });

    it("should update state with WATCH/MULTI transaction", async () => {
      const { __mockRedis } = await getMocks();
      const testState = createTestState();

      // First get is index lookup, second is actual state
      __mockRedis.get
        .mockResolvedValueOnce("order-456")
        .mockResolvedValueOnce(
          JSON.stringify({
            ...testState,
            metadata: {
              ...testState.metadata,
              version: 1,
              createdAt: testState.metadata.createdAt.toISOString(),
              updatedAt: testState.metadata.updatedAt.toISOString(),
            },
          })
        );

      const store = new RedisSagaStore<TestState>({
        connection: { host: "localhost", port: 6379 },
      });
      await store.initialize();

      const newState = createTestState({
        metadata: { ...testState.metadata, version: 2 },
      });
      await store.update("OrderSaga", newState, 1);

      expect(__mockRedis.watch).toHaveBeenCalled();
      expect(__mockRedis.multi).toHaveBeenCalled();
    });

    it("should throw ConcurrencyError on version mismatch", async () => {
      const { __mockRedis } = await getMocks();
      const testState = createTestState();

      // Return existing state with different version
      __mockRedis.get
        .mockResolvedValueOnce("order-456")
        .mockResolvedValueOnce(
          JSON.stringify({
            ...testState,
            metadata: {
              ...testState.metadata,
              version: 5,
              createdAt: testState.metadata.createdAt.toISOString(),
              updatedAt: testState.metadata.updatedAt.toISOString(),
            },
          })
        );

      const store = new RedisSagaStore<TestState>({
        connection: { host: "localhost", port: 6379 },
      });
      await store.initialize();

      const state = createTestState({
        metadata: { ...testState.metadata, version: 2 },
      });
      await expect(store.update("OrderSaga", state, 1)).rejects.toThrow(
        /Concurrency/
      );
      expect(__mockRedis.unwatch).toHaveBeenCalled();
    });

    it("should throw if saga not found", async () => {
      const { __mockRedis } = await getMocks();
      __mockRedis.get.mockResolvedValue(null);

      const store = new RedisSagaStore<TestState>({
        connection: { host: "localhost", port: 6379 },
      });
      await store.initialize();

      const state = createTestState();
      await expect(store.update("OrderSaga", state, 0)).rejects.toThrow(
        "not found"
      );
    });

    it("should retry on transaction abort", async () => {
      const { __mockRedis, __createMockMulti } = await getMocks();
      const testState = createTestState();

      // Index lookup and state lookup for each attempt
      __mockRedis.get.mockResolvedValue(
        JSON.stringify({
          ...testState,
          metadata: {
            ...testState.metadata,
            version: 1,
            createdAt: testState.metadata.createdAt.toISOString(),
            updatedAt: testState.metadata.updatedAt.toISOString(),
          },
        })
      );
      // Make first index lookup return correlation ID
      __mockRedis.get.mockResolvedValueOnce("order-456");

      // First transaction fails (returns null), second succeeds
      const mockMulti1 = __createMockMulti();
      mockMulti1.exec.mockResolvedValue(null);
      const mockMulti2 = __createMockMulti();
      mockMulti2.exec.mockResolvedValue([["OK"], ["OK"]]);

      __mockRedis.multi
        .mockReturnValueOnce(mockMulti1)
        .mockReturnValueOnce(mockMulti2);

      const store = new RedisSagaStore<TestState>({
        connection: { host: "localhost", port: 6379 },
        maxRetries: 3,
        retryDelayMs: 10,
      });
      await store.initialize();

      const state = createTestState({
        metadata: { ...testState.metadata, version: 2 },
      });
      await store.update("OrderSaga", state, 1);

      expect(__mockRedis.multi).toHaveBeenCalledTimes(2);
    });
  });

  describe("delete", () => {
    it("should delete state and index", async () => {
      const { __mockRedis } = await getMocks();
      __mockRedis.get.mockResolvedValue("order-456");

      const store = new RedisSagaStore<TestState>({
        connection: { host: "localhost", port: 6379 },
      });
      await store.initialize();

      await store.delete("OrderSaga", "saga-123");

      expect(__mockRedis.del).toHaveBeenCalledWith(
        "saga-bus:saga:OrderSaga:order-456",
        "saga-bus:saga:OrderSaga:idx:id:saga-123"
      );
    });

    it("should not delete if saga not found", async () => {
      const { __mockRedis } = await getMocks();
      __mockRedis.get.mockResolvedValue(null);

      const store = new RedisSagaStore<TestState>({
        connection: { host: "localhost", port: 6379 },
      });
      await store.initialize();

      await store.delete("OrderSaga", "saga-123");

      expect(__mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe("serialization", () => {
    it("should handle null timeoutExpiresAt", async () => {
      const { __mockRedis } = await getMocks();
      const testState = createTestState();
      __mockRedis.get.mockResolvedValue(
        JSON.stringify({
          ...testState,
          metadata: {
            ...testState.metadata,
            createdAt: testState.metadata.createdAt.toISOString(),
            updatedAt: testState.metadata.updatedAt.toISOString(),
            timeoutExpiresAt: null,
          },
        })
      );

      const store = new RedisSagaStore<TestState>({
        connection: { host: "localhost", port: 6379 },
      });
      await store.initialize();

      const result = await store.getByCorrelationId("OrderSaga", "order-456");
      expect(result?.metadata.timeoutExpiresAt).toBeNull();
    });
  });
});
