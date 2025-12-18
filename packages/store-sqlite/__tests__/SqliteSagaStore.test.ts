import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { SqliteSagaStore, createSchema } from "../src/index.js";
import { ConcurrencyError, type SagaState } from "@saga-bus/core";

interface TestState extends SagaState {
  orderId: string;
  status: string;
}

function createTestState(
  sagaId: string,
  version: number = 1,
  overrides: Partial<TestState> = {}
): TestState {
  const now = new Date();
  return {
    metadata: {
      sagaId,
      version,
      createdAt: now,
      updatedAt: now,
      isCompleted: false,
    },
    orderId: "order-123",
    status: "pending",
    ...overrides,
  };
}

describe("SqliteSagaStore", () => {
  let db: Database.Database;
  let store: SqliteSagaStore<TestState>;

  beforeEach(() => {
    db = new Database(":memory:");
    createSchema(db);
    store = new SqliteSagaStore({ db });
  });

  afterEach(() => {
    db.close();
  });

  describe("getById", () => {
    it("should return null for non-existent saga", async () => {
      const result = await store.getById("TestSaga", "non-existent");
      expect(result).toBeNull();
    });

    it("should return saga state after insert", async () => {
      const state = createTestState("saga-1");
      await store.insert("TestSaga", "corr-123", state);

      const result = await store.getById("TestSaga", "saga-1");
      expect(result).not.toBeNull();
      expect(result?.metadata.sagaId).toBe("saga-1");
      expect(result?.orderId).toBe("order-123");
    });
  });

  describe("getByCorrelationId", () => {
    it("should return null for non-existent correlation", async () => {
      const result = await store.getByCorrelationId("TestSaga", "non-existent");
      expect(result).toBeNull();
    });

    it("should return saga state by correlation ID", async () => {
      const state = createTestState("saga-1");
      await store.insert("TestSaga", "corr-123", state);

      const result = await store.getByCorrelationId("TestSaga", "corr-123");
      expect(result).not.toBeNull();
      expect(result?.metadata.sagaId).toBe("saga-1");
    });
  });

  describe("insert", () => {
    it("should insert new saga with version 1", async () => {
      const state = createTestState("saga-1");
      await store.insert("TestSaga", "corr-123", state);

      const result = await store.getById("TestSaga", "saga-1");
      expect(result?.metadata.version).toBe(1);
    });

    it("should throw on duplicate saga ID", async () => {
      const state = createTestState("saga-1");
      await store.insert("TestSaga", "corr-123", state);

      await expect(
        store.insert("TestSaga", "corr-456", state)
      ).rejects.toThrow("already exists");
    });
  });

  describe("update", () => {
    it("should update saga state", async () => {
      const state1 = createTestState("saga-1", 1);
      await store.insert("TestSaga", "corr-123", state1);

      const state2 = createTestState("saga-1", 2, { status: "confirmed" });
      await store.update("TestSaga", state2, 1);

      const result = await store.getById("TestSaga", "saga-1");
      expect(result?.metadata.version).toBe(2);
      expect(result?.status).toBe("confirmed");
    });

    it("should throw ConcurrencyError on version mismatch", async () => {
      const state = createTestState("saga-1", 1);
      await store.insert("TestSaga", "corr-123", state);

      const state2 = createTestState("saga-1", 100);
      await expect(store.update("TestSaga", state2, 99)).rejects.toThrow(
        ConcurrencyError
      );
    });

    it("should throw error for non-existent saga", async () => {
      const state = createTestState("non-existent", 2);
      await expect(store.update("TestSaga", state, 1)).rejects.toThrow(
        "not found"
      );
    });
  });

  describe("delete", () => {
    it("should delete existing saga", async () => {
      const state = createTestState("saga-1");
      await store.insert("TestSaga", "corr-123", state);

      await store.delete("TestSaga", "saga-1");

      const result = await store.getById("TestSaga", "saga-1");
      expect(result).toBeNull();
    });

    it("should not throw when deleting non-existent saga", async () => {
      await expect(
        store.delete("TestSaga", "non-existent")
      ).resolves.not.toThrow();
    });
  });

  describe("createSchema", () => {
    it("should create table with custom name", () => {
      const customDb = new Database(":memory:");
      createSchema(customDb, "custom_sagas");

      const tables = customDb
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='custom_sagas'"
        )
        .all();
      expect(tables).toHaveLength(1);

      customDb.close();
    });

    it("should be idempotent", () => {
      // Should not throw when called multiple times
      createSchema(db);
      createSchema(db);
    });
  });
});
