import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SagaState } from "@saga-bus/core";
import { ConcurrencyError } from "@saga-bus/core";

// Mock mssql
const mockRequest = {
  input: vi.fn().mockReturnThis(),
  query: vi.fn(),
};

const mockPool = {
  request: vi.fn(() => mockRequest),
  close: vi.fn(),
  connect: vi.fn(),
};

vi.mock("mssql", () => ({
  default: {
    ConnectionPool: vi.fn().mockImplementation(() => ({
      ...mockPool,
      connect: vi.fn().mockResolvedValue(mockPool),
    })),
    NVarChar: vi.fn((size) => ({ type: "nvarchar", size })),
    Int: { type: "int" },
    Bit: { type: "bit" },
    DateTime2: { type: "datetime2" },
    MAX: -1,
  },
  ConnectionPool: vi.fn().mockImplementation(() => ({
    ...mockPool,
    connect: vi.fn().mockResolvedValue(mockPool),
  })),
  NVarChar: vi.fn((size) => ({ type: "nvarchar", size })),
  Int: { type: "int" },
  Bit: { type: "bit" },
  DateTime2: { type: "datetime2" },
  MAX: -1,
}));

import { SqlServerSagaStore } from "../src/SqlServerSagaStore.js";

interface OrderState extends SagaState {
  orderId: string;
  status: string;
  total: number;
}

describe("SqlServerSagaStore", () => {
  let store: SqlServerSagaStore<OrderState>;

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
    mockRequest.query.mockReset();
    mockRequest.input.mockReturnThis();
    mockPool.request.mockReturnValue(mockRequest);
  });

  describe("constructor", () => {
    it("should accept pool configuration", () => {
      store = new SqlServerSagaStore({
        pool: {
          server: "localhost",
          database: "test",
          user: "sa",
          password: "password",
        },
      });
      expect(store).toBeDefined();
    });

    it("should use custom table name", () => {
      store = new SqlServerSagaStore({
        pool: { server: "localhost", database: "test" },
        tableName: "custom_sagas",
      });
      expect(store).toBeDefined();
    });

    it("should use custom schema", () => {
      store = new SqlServerSagaStore({
        pool: { server: "localhost", database: "test" },
        schema: "custom",
      });
      expect(store).toBeDefined();
    });
  });

  describe("initialize", () => {
    it("should connect the pool when using config", async () => {
      store = new SqlServerSagaStore({
        pool: { server: "localhost", database: "test" },
      });

      await store.initialize();
      expect(store.getPool()).toBeDefined();
    });
  });

  describe("getById", () => {
    beforeEach(async () => {
      store = new SqlServerSagaStore({
        pool: { server: "localhost", database: "test" },
      });
      await store.initialize();
    });

    it("should return null when saga not found", async () => {
      mockRequest.query.mockResolvedValue({ recordset: [] });

      const result = await store.getById("OrderSaga", "not-found");
      expect(result).toBeNull();
    });

    it("should return state when saga found", async () => {
      const state = createState();
      mockRequest.query.mockResolvedValue({
        recordset: [
          {
            id: state.metadata.sagaId,
            saga_name: "OrderSaga",
            correlation_id: "order-123",
            version: state.metadata.version,
            is_completed: state.metadata.isCompleted,
            state: JSON.stringify(state),
            created_at: state.metadata.createdAt,
            updated_at: state.metadata.updatedAt,
          },
        ],
      });

      const result = await store.getById("OrderSaga", "saga-123");
      expect(result).not.toBeNull();
      expect(result!.orderId).toBe("order-123");
      expect(result!.metadata.sagaId).toBe("saga-123");
    });

    it("should throw if not initialized", async () => {
      const uninitializedStore = new SqlServerSagaStore({
        pool: { server: "localhost", database: "test" },
      });

      await expect(
        uninitializedStore.getById("OrderSaga", "saga-123")
      ).rejects.toThrow("Store not initialized");
    });
  });

  describe("getByCorrelationId", () => {
    beforeEach(async () => {
      store = new SqlServerSagaStore({
        pool: { server: "localhost", database: "test" },
      });
      await store.initialize();
    });

    it("should return null when saga not found", async () => {
      mockRequest.query.mockResolvedValue({ recordset: [] });

      const result = await store.getByCorrelationId("OrderSaga", "not-found");
      expect(result).toBeNull();
    });

    it("should return state when saga found", async () => {
      const state = createState();
      mockRequest.query.mockResolvedValue({
        recordset: [
          {
            id: state.metadata.sagaId,
            saga_name: "OrderSaga",
            correlation_id: "order-123",
            version: state.metadata.version,
            is_completed: state.metadata.isCompleted,
            state: JSON.stringify(state),
            created_at: state.metadata.createdAt,
            updated_at: state.metadata.updatedAt,
          },
        ],
      });

      const result = await store.getByCorrelationId("OrderSaga", "order-123");
      expect(result).not.toBeNull();
      expect(result!.orderId).toBe("order-123");
    });
  });

  describe("insert", () => {
    beforeEach(async () => {
      store = new SqlServerSagaStore({
        pool: { server: "localhost", database: "test" },
      });
      await store.initialize();
    });

    it("should insert saga state", async () => {
      mockRequest.query.mockResolvedValue({ rowsAffected: [1] });
      const state = createState();

      await store.insert("OrderSaga", "order-123", state);

      expect(mockRequest.input).toHaveBeenCalledWith(
        "id",
        expect.anything(),
        "saga-123"
      );
      expect(mockRequest.input).toHaveBeenCalledWith(
        "saga_name",
        expect.anything(),
        "OrderSaga"
      );
      expect(mockRequest.input).toHaveBeenCalledWith(
        "correlation_id",
        expect.anything(),
        "order-123"
      );
    });

    it("should serialize state as JSON", async () => {
      mockRequest.query.mockResolvedValue({ rowsAffected: [1] });
      const state = createState();

      await store.insert("OrderSaga", "order-123", state);

      expect(mockRequest.input).toHaveBeenCalledWith(
        "state",
        expect.anything(),
        expect.stringContaining('"orderId":"order-123"')
      );
    });
  });

  describe("update", () => {
    beforeEach(async () => {
      store = new SqlServerSagaStore({
        pool: { server: "localhost", database: "test" },
      });
      await store.initialize();
    });

    it("should update saga state with correct version", async () => {
      mockRequest.query.mockResolvedValue({ rowsAffected: [1] });
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

      expect(mockRequest.input).toHaveBeenCalledWith(
        "expected_version",
        expect.anything(),
        1
      );
      expect(mockRequest.input).toHaveBeenCalledWith(
        "version",
        expect.anything(),
        2
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
      mockRequest.query.mockResolvedValueOnce({ rowsAffected: [0] });
      // Second call: getById returns existing state
      mockRequest.query.mockResolvedValueOnce({
        recordset: [
          {
            id: existingState.metadata.sagaId,
            saga_name: "OrderSaga",
            correlation_id: "order-123",
            version: 3,
            is_completed: false,
            state: JSON.stringify(existingState),
            created_at: existingState.metadata.createdAt,
            updated_at: existingState.metadata.updatedAt,
          },
        ],
      });

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
      mockRequest.query.mockResolvedValueOnce({ rowsAffected: [0] });
      // Second call: getById returns null
      mockRequest.query.mockResolvedValueOnce({ recordset: [] });

      const state = createState();

      await expect(store.update("OrderSaga", state, 1)).rejects.toThrow(
        "Saga saga-123 not found"
      );
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      store = new SqlServerSagaStore({
        pool: { server: "localhost", database: "test" },
      });
      await store.initialize();
    });

    it("should delete saga by id", async () => {
      mockRequest.query.mockResolvedValue({ rowsAffected: [1] });

      await store.delete("OrderSaga", "saga-123");

      expect(mockRequest.input).toHaveBeenCalledWith(
        "id",
        expect.anything(),
        "saga-123"
      );
      expect(mockRequest.input).toHaveBeenCalledWith(
        "saga_name",
        expect.anything(),
        "OrderSaga"
      );
    });
  });

  describe("close", () => {
    it("should close the pool if owned", async () => {
      store = new SqlServerSagaStore({
        pool: { server: "localhost", database: "test" },
      });
      await store.initialize();

      await store.close();

      expect(mockPool.close).toHaveBeenCalled();
      expect(store.getPool()).toBeNull();
    });
  });

  describe("findByName", () => {
    beforeEach(async () => {
      store = new SqlServerSagaStore({
        pool: { server: "localhost", database: "test" },
      });
      await store.initialize();
    });

    it("should return sagas by name", async () => {
      const state = createState();
      mockRequest.query.mockResolvedValue({
        recordset: [
          {
            id: state.metadata.sagaId,
            saga_name: "OrderSaga",
            correlation_id: "order-123",
            version: state.metadata.version,
            is_completed: state.metadata.isCompleted,
            state: JSON.stringify(state),
            created_at: state.metadata.createdAt,
            updated_at: state.metadata.updatedAt,
          },
        ],
      });

      const results = await store.findByName("OrderSaga");
      expect(results).toHaveLength(1);
      expect(results[0]!.orderId).toBe("order-123");
    });

    it("should filter by completed status", async () => {
      mockRequest.query.mockResolvedValue({ recordset: [] });

      await store.findByName("OrderSaga", { completed: true });

      expect(mockRequest.input).toHaveBeenCalledWith(
        "is_completed",
        expect.anything(),
        1
      );
    });

    it("should support pagination with limit", async () => {
      mockRequest.query.mockResolvedValue({ recordset: [] });

      await store.findByName("OrderSaga", { limit: 10 });

      expect(mockRequest.input).toHaveBeenCalledWith(
        "limit",
        expect.anything(),
        10
      );
    });

    it("should support pagination with offset", async () => {
      mockRequest.query.mockResolvedValue({ recordset: [] });

      await store.findByName("OrderSaga", { offset: 20, limit: 10 });

      expect(mockRequest.input).toHaveBeenCalledWith(
        "offset",
        expect.anything(),
        20
      );
      expect(mockRequest.input).toHaveBeenCalledWith(
        "limit",
        expect.anything(),
        10
      );
    });
  });

  describe("countByName", () => {
    beforeEach(async () => {
      store = new SqlServerSagaStore({
        pool: { server: "localhost", database: "test" },
      });
      await store.initialize();
    });

    it("should return count of sagas", async () => {
      mockRequest.query.mockResolvedValue({
        recordset: [{ count: 42 }],
      });

      const count = await store.countByName("OrderSaga");
      expect(count).toBe(42);
    });

    it("should filter by completed status", async () => {
      mockRequest.query.mockResolvedValue({
        recordset: [{ count: 10 }],
      });

      await store.countByName("OrderSaga", { completed: true });

      expect(mockRequest.input).toHaveBeenCalledWith(
        "is_completed",
        expect.anything(),
        1
      );
    });
  });

  describe("deleteCompletedBefore", () => {
    beforeEach(async () => {
      store = new SqlServerSagaStore({
        pool: { server: "localhost", database: "test" },
      });
      await store.initialize();
    });

    it("should delete completed sagas before date", async () => {
      mockRequest.query.mockResolvedValue({ rowsAffected: [5] });

      const before = new Date("2024-01-01");
      const count = await store.deleteCompletedBefore("OrderSaga", before);

      expect(count).toBe(5);
      expect(mockRequest.input).toHaveBeenCalledWith(
        "before",
        expect.anything(),
        before
      );
    });
  });

  describe("schema handling", () => {
    it("should use dbo schema by default", async () => {
      store = new SqlServerSagaStore({
        pool: { server: "localhost", database: "test" },
      });
      await store.initialize();
      mockRequest.query.mockResolvedValue({ recordset: [] });

      await store.getById("OrderSaga", "saga-123");

      expect(mockRequest.query).toHaveBeenCalledWith(
        expect.stringContaining("[dbo].[saga_instances]")
      );
    });

    it("should use custom schema when specified", async () => {
      store = new SqlServerSagaStore({
        pool: { server: "localhost", database: "test" },
        schema: "app",
      });
      await store.initialize();
      mockRequest.query.mockResolvedValue({ recordset: [] });

      await store.getById("OrderSaga", "saga-123");

      expect(mockRequest.query).toHaveBeenCalledWith(
        expect.stringContaining("[app].[saga_instances]")
      );
    });

    it("should use custom table name when specified", async () => {
      store = new SqlServerSagaStore({
        pool: { server: "localhost", database: "test" },
        tableName: "sagas",
      });
      await store.initialize();
      mockRequest.query.mockResolvedValue({ recordset: [] });

      await store.getById("OrderSaga", "saga-123");

      expect(mockRequest.query).toHaveBeenCalledWith(
        expect.stringContaining("[dbo].[sagas]")
      );
    });
  });
});
