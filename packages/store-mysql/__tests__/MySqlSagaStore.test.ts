import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SagaState } from "@saga-bus/core";
import { ConcurrencyError } from "@saga-bus/core";

// Mock mysql2/promise
const mockPool = {
  query: vi.fn(),
  end: vi.fn(),
};

vi.mock("mysql2/promise", () => ({
  createPool: vi.fn(() => mockPool),
  default: {
    createPool: vi.fn(() => mockPool),
  },
}));

import { MySqlSagaStore } from "../src/MySqlSagaStore.js";

interface OrderState extends SagaState {
  orderId: string;
  status: string;
  total: number;
}

describe("MySqlSagaStore", () => {
  let store: MySqlSagaStore<OrderState>;

  const createState = (
    overrides: Partial<OrderState> = {}
  ): OrderState => ({
    orderId: "order-123",
    status: "pending",
    total: 100,
    metadata: {
      sagaId: "saga-123",
      version: 1,
      isCompleted: false,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
      archivedAt: null,
      timeoutMs: null,
      timeoutExpiresAt: null,
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.query.mockReset();
  });

  describe("constructor", () => {
    it("should accept pool configuration", () => {
      store = new MySqlSagaStore({
        pool: {
          host: "localhost",
          database: "test",
          user: "root",
          password: "password",
        },
      });
      expect(store).toBeDefined();
    });

    it("should use custom table name", () => {
      store = new MySqlSagaStore({
        pool: { host: "localhost", database: "test" },
        tableName: "custom_sagas",
      });
      expect(store).toBeDefined();
    });
  });

  describe("initialize", () => {
    it("should create the pool when using config", async () => {
      store = new MySqlSagaStore({
        pool: { host: "localhost", database: "test" },
      });

      await store.initialize();
      expect(store.getPool()).toBeDefined();
    });
  });

  describe("getById", () => {
    beforeEach(async () => {
      store = new MySqlSagaStore({
        pool: { host: "localhost", database: "test" },
      });
      await store.initialize();
    });

    it("should return null when saga not found", async () => {
      mockPool.query.mockResolvedValue([[], []]);

      const result = await store.getById("OrderSaga", "not-found");
      expect(result).toBeNull();
    });

    it("should return state when saga found", async () => {
      const state = createState();
      mockPool.query.mockResolvedValue([
        [
          {
            id: state.metadata.sagaId,
            saga_name: "OrderSaga",
            correlation_id: "order-123",
            version: state.metadata.version,
            is_completed: 0,
            state: JSON.stringify(state),
            created_at: state.metadata.createdAt,
            updated_at: state.metadata.updatedAt,
          },
        ],
        [],
      ]);

      const result = await store.getById("OrderSaga", "saga-123");
      expect(result).not.toBeNull();
      expect(result!.orderId).toBe("order-123");
      expect(result!.metadata.sagaId).toBe("saga-123");
    });

    it("should throw if not initialized", async () => {
      const uninitializedStore = new MySqlSagaStore({
        pool: { host: "localhost", database: "test" },
      });

      await expect(
        uninitializedStore.getById("OrderSaga", "saga-123")
      ).rejects.toThrow("Store not initialized");
    });
  });

  describe("getByCorrelationId", () => {
    beforeEach(async () => {
      store = new MySqlSagaStore({
        pool: { host: "localhost", database: "test" },
      });
      await store.initialize();
    });

    it("should return null when saga not found", async () => {
      mockPool.query.mockResolvedValue([[], []]);

      const result = await store.getByCorrelationId("OrderSaga", "not-found");
      expect(result).toBeNull();
    });

    it("should return state when saga found", async () => {
      const state = createState();
      mockPool.query.mockResolvedValue([
        [
          {
            id: state.metadata.sagaId,
            saga_name: "OrderSaga",
            correlation_id: "order-123",
            version: state.metadata.version,
            is_completed: 0,
            state: JSON.stringify(state),
            created_at: state.metadata.createdAt,
            updated_at: state.metadata.updatedAt,
          },
        ],
        [],
      ]);

      const result = await store.getByCorrelationId("OrderSaga", "order-123");
      expect(result).not.toBeNull();
      expect(result!.orderId).toBe("order-123");
    });
  });

  describe("insert", () => {
    beforeEach(async () => {
      store = new MySqlSagaStore({
        pool: { host: "localhost", database: "test" },
      });
      await store.initialize();
    });

    it("should insert saga state", async () => {
      mockPool.query.mockResolvedValue([{ affectedRows: 1 }, []]);
      const state = createState();

      await store.insert("OrderSaga", "order-123", state);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO"),
        expect.arrayContaining(["saga-123", "OrderSaga", "order-123"])
      );
    });

    it("should serialize state as JSON", async () => {
      mockPool.query.mockResolvedValue([{ affectedRows: 1 }, []]);
      const state = createState();

      await store.insert("OrderSaga", "order-123", state);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.stringContaining('"orderId":"order-123"')])
      );
    });
  });

  describe("update", () => {
    beforeEach(async () => {
      store = new MySqlSagaStore({
        pool: { host: "localhost", database: "test" },
      });
      await store.initialize();
    });

    it("should update saga state with correct version", async () => {
      mockPool.query.mockResolvedValue([{ affectedRows: 1 }, []]);
      const state = createState({
        metadata: {
          sagaId: "saga-123",
          version: 2,
          isCompleted: false,
          createdAt: new Date("2024-01-01T00:00:00Z"),
          updatedAt: new Date("2024-01-02T00:00:00Z"),
          archivedAt: null,
          timeoutMs: null,
          timeoutExpiresAt: null,
        },
      });

      await store.update("OrderSaga", state, 1);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE"),
        expect.arrayContaining([2, "saga-123", "OrderSaga", 1])
      );
    });

    it("should throw ConcurrencyError on version mismatch", async () => {
      const existingState = createState({
        metadata: {
          sagaId: "saga-123",
          version: 3,
          isCompleted: false,
          createdAt: new Date("2024-01-01T00:00:00Z"),
          updatedAt: new Date("2024-01-02T00:00:00Z"),
          archivedAt: null,
          timeoutMs: null,
          timeoutExpiresAt: null,
        },
      });

      // First call: update returns 0 rows affected
      mockPool.query.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
      // Second call: getById returns existing state
      mockPool.query.mockResolvedValueOnce([
        [
          {
            id: existingState.metadata.sagaId,
            saga_name: "OrderSaga",
            correlation_id: "order-123",
            version: 3,
            is_completed: 0,
            state: JSON.stringify(existingState),
            created_at: existingState.metadata.createdAt,
            updated_at: existingState.metadata.updatedAt,
          },
        ],
        [],
      ]);

      const state = createState({
        metadata: {
          sagaId: "saga-123",
          version: 2,
          isCompleted: false,
          createdAt: new Date("2024-01-01T00:00:00Z"),
          updatedAt: new Date("2024-01-02T00:00:00Z"),
          archivedAt: null,
          timeoutMs: null,
          timeoutExpiresAt: null,
        },
      });

      await expect(store.update("OrderSaga", state, 1)).rejects.toThrow(
        ConcurrencyError
      );
    });

    it("should throw error if saga not found", async () => {
      // First call: update returns 0 rows affected
      mockPool.query.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
      // Second call: getById returns null
      mockPool.query.mockResolvedValueOnce([[], []]);

      const state = createState();

      await expect(store.update("OrderSaga", state, 1)).rejects.toThrow(
        "Saga saga-123 not found"
      );
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      store = new MySqlSagaStore({
        pool: { host: "localhost", database: "test" },
      });
      await store.initialize();
    });

    it("should delete saga by id", async () => {
      mockPool.query.mockResolvedValue([{ affectedRows: 1 }, []]);

      await store.delete("OrderSaga", "saga-123");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM"),
        ["saga-123", "OrderSaga"]
      );
    });
  });

  describe("close", () => {
    it("should close the pool if owned", async () => {
      store = new MySqlSagaStore({
        pool: { host: "localhost", database: "test" },
      });
      await store.initialize();

      await store.close();

      expect(mockPool.end).toHaveBeenCalled();
      expect(store.getPool()).toBeNull();
    });
  });

  describe("findByName", () => {
    beforeEach(async () => {
      store = new MySqlSagaStore({
        pool: { host: "localhost", database: "test" },
      });
      await store.initialize();
    });

    it("should return sagas by name", async () => {
      const state = createState();
      mockPool.query.mockResolvedValue([
        [
          {
            id: state.metadata.sagaId,
            saga_name: "OrderSaga",
            correlation_id: "order-123",
            version: state.metadata.version,
            is_completed: 0,
            state: JSON.stringify(state),
            created_at: state.metadata.createdAt,
            updated_at: state.metadata.updatedAt,
          },
        ],
        [],
      ]);

      const results = await store.findByName("OrderSaga");
      expect(results).toHaveLength(1);
      expect(results[0]!.orderId).toBe("order-123");
    });

    it("should filter by completed status", async () => {
      mockPool.query.mockResolvedValue([[], []]);

      await store.findByName("OrderSaga", { completed: true });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("is_completed = ?"),
        expect.arrayContaining([1])
      );
    });

    it("should support pagination with limit", async () => {
      mockPool.query.mockResolvedValue([[], []]);

      await store.findByName("OrderSaga", { limit: 10 });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT ?"),
        expect.arrayContaining([10])
      );
    });

    it("should support pagination with offset", async () => {
      mockPool.query.mockResolvedValue([[], []]);

      await store.findByName("OrderSaga", { offset: 20, limit: 10 });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("OFFSET ?"),
        expect.arrayContaining([20])
      );
    });
  });

  describe("countByName", () => {
    beforeEach(async () => {
      store = new MySqlSagaStore({
        pool: { host: "localhost", database: "test" },
      });
      await store.initialize();
    });

    it("should return count of sagas", async () => {
      mockPool.query.mockResolvedValue([[{ count: 42 }], []]);

      const count = await store.countByName("OrderSaga");
      expect(count).toBe(42);
    });

    it("should filter by completed status", async () => {
      mockPool.query.mockResolvedValue([[{ count: 10 }], []]);

      await store.countByName("OrderSaga", { completed: true });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("is_completed = ?"),
        expect.arrayContaining([1])
      );
    });
  });

  describe("deleteCompletedBefore", () => {
    beforeEach(async () => {
      store = new MySqlSagaStore({
        pool: { host: "localhost", database: "test" },
      });
      await store.initialize();
    });

    it("should delete completed sagas before date", async () => {
      mockPool.query.mockResolvedValue([{ affectedRows: 5 }, []]);

      const before = new Date("2024-01-01");
      const count = await store.deleteCompletedBefore("OrderSaga", before);

      expect(count).toBe(5);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("is_completed = 1 AND updated_at < ?"),
        ["OrderSaga", before]
      );
    });
  });

  describe("table name handling", () => {
    it("should use saga_instances by default", async () => {
      store = new MySqlSagaStore({
        pool: { host: "localhost", database: "test" },
      });
      await store.initialize();
      mockPool.query.mockResolvedValue([[], []]);

      await store.getById("OrderSaga", "saga-123");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("`saga_instances`"),
        expect.any(Array)
      );
    });

    it("should use custom table name when specified", async () => {
      store = new MySqlSagaStore({
        pool: { host: "localhost", database: "test" },
        tableName: "sagas",
      });
      await store.initialize();
      mockPool.query.mockResolvedValue([[], []]);

      await store.getById("OrderSaga", "saga-123");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("`sagas`"),
        expect.any(Array)
      );
    });
  });

  describe("boolean handling", () => {
    beforeEach(async () => {
      store = new MySqlSagaStore({
        pool: { host: "localhost", database: "test" },
      });
      await store.initialize();
    });

    it("should convert is_completed=1 to true", async () => {
      const state = createState();
      mockPool.query.mockResolvedValue([
        [
          {
            id: state.metadata.sagaId,
            saga_name: "OrderSaga",
            correlation_id: "order-123",
            version: state.metadata.version,
            is_completed: 1,
            state: JSON.stringify({ ...state, metadata: { ...state.metadata, isCompleted: true } }),
            created_at: state.metadata.createdAt,
            updated_at: state.metadata.updatedAt,
          },
        ],
        [],
      ]);

      const result = await store.getById("OrderSaga", "saga-123");
      expect(result!.metadata.isCompleted).toBe(true);
    });

    it("should convert is_completed=0 to false", async () => {
      const state = createState();
      mockPool.query.mockResolvedValue([
        [
          {
            id: state.metadata.sagaId,
            saga_name: "OrderSaga",
            correlation_id: "order-123",
            version: state.metadata.version,
            is_completed: 0,
            state: JSON.stringify(state),
            created_at: state.metadata.createdAt,
            updated_at: state.metadata.updatedAt,
          },
        ],
        [],
      ]);

      const result = await store.getById("OrderSaga", "saga-123");
      expect(result!.metadata.isCompleted).toBe(false);
    });

    it("should store isCompleted=true as 1", async () => {
      mockPool.query.mockResolvedValue([{ affectedRows: 1 }, []]);
      const state = createState({
        metadata: {
          sagaId: "saga-123",
          version: 1,
          isCompleted: true,
          createdAt: new Date("2024-01-01T00:00:00Z"),
          updatedAt: new Date("2024-01-01T00:00:00Z"),
          archivedAt: null,
          timeoutMs: null,
          timeoutExpiresAt: null,
        },
      });

      await store.insert("OrderSaga", "order-123", state);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1]) // is_completed = 1
      );
    });
  });
});
