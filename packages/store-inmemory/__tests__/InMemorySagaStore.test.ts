import { describe, it, expect, beforeEach } from "vitest";
import type { SagaState, SagaStateMetadata } from "@saga-bus/core";
import { ConcurrencyError } from "@saga-bus/core";
import { InMemorySagaStore } from "../src/InMemorySagaStore.js";

interface TestState extends SagaState {
  metadata: SagaStateMetadata;
  orderId: string;
  status: string;
  items: string[];
}

function createTestState(
  sagaId: string,
  overrides: Partial<TestState> = {}
): TestState {
  return {
    metadata: {
      sagaId,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isCompleted: false,
    },
    orderId: sagaId,
    status: "pending",
    items: [],
    ...overrides,
  };
}

describe("InMemorySagaStore", () => {
  let store: InMemorySagaStore<TestState>;
  const sagaName = "TestSaga";

  beforeEach(() => {
    store = new InMemorySagaStore<TestState>();
  });

  describe("insert", () => {
    it("should insert a new saga", async () => {
      const state = createTestState("saga-1");

      await store.insert(sagaName, "corr-1", state);

      expect(store.size).toBe(1);
      expect(store.has(sagaName, "saga-1")).toBe(true);
    });

    it("should throw when inserting duplicate saga", async () => {
      const state = createTestState("saga-1");

      await store.insert(sagaName, "corr-1", state);

      await expect(store.insert(sagaName, "corr-2", state)).rejects.toThrow(
        "already exists"
      );
    });

    it("should clone state to prevent external mutation", async () => {
      const state = createTestState("saga-1", { items: ["item1"] });

      await store.insert(sagaName, "corr-1", state);

      // Mutate original
      state.items.push("item2");

      // Stored state should be unchanged
      const retrieved = await store.getById(sagaName, "saga-1");
      expect(retrieved?.items).toEqual(["item1"]);
    });
  });

  describe("getById", () => {
    it("should retrieve an existing saga", async () => {
      const state = createTestState("saga-1", { status: "active" });
      await store.insert(sagaName, "corr-1", state);

      const retrieved = await store.getById(sagaName, "saga-1");

      expect(retrieved).not.toBeNull();
      expect(retrieved?.metadata.sagaId).toBe("saga-1");
      expect(retrieved?.status).toBe("active");
    });

    it("should return null for non-existent saga", async () => {
      const retrieved = await store.getById(sagaName, "non-existent");

      expect(retrieved).toBeNull();
    });

    it("should return cloned state", async () => {
      const state = createTestState("saga-1", { items: ["item1"] });
      await store.insert(sagaName, "corr-1", state);

      const retrieved = await store.getById(sagaName, "saga-1");
      retrieved?.items.push("mutated");

      // Original stored state should be unchanged
      const retrieved2 = await store.getById(sagaName, "saga-1");
      expect(retrieved2?.items).toEqual(["item1"]);
    });
  });

  describe("getByCorrelationId", () => {
    it("should retrieve saga by correlation ID", async () => {
      const state = createTestState("saga-1");
      await store.insert(sagaName, "order-123", state);

      const retrieved = await store.getByCorrelationId(sagaName, "order-123");

      expect(retrieved).not.toBeNull();
      expect(retrieved?.metadata.sagaId).toBe("saga-1");
    });

    it("should return null for non-indexed correlation", async () => {
      const state = createTestState("saga-1");
      await store.insert(sagaName, "other-corr", state);
      // Insert with different correlation

      const retrieved = await store.getByCorrelationId(sagaName, "order-123");

      expect(retrieved).toBeNull();
    });
  });

  describe("update", () => {
    it("should update an existing saga", async () => {
      const state = createTestState("saga-1");
      await store.insert(sagaName, "corr-1", state);

      const updated: TestState = {
        ...state,
        metadata: {
          ...state.metadata,
          version: 1,
          updatedAt: new Date(),
        },
        status: "completed",
      };

      await store.update(sagaName, updated, 0);

      const retrieved = await store.getById(sagaName, "saga-1");
      expect(retrieved?.status).toBe("completed");
      expect(retrieved?.metadata.version).toBe(1);
    });

    it("should throw ConcurrencyError on version mismatch", async () => {
      const state = createTestState("saga-1");
      await store.insert(sagaName, "corr-1", state);

      const updated: TestState = {
        ...state,
        metadata: { ...state.metadata, version: 1 },
        status: "completed",
      };

      // Try to update with wrong expected version
      await expect(
        store.update(sagaName, updated, 5) // expected 5, but actual is 0
      ).rejects.toThrow(ConcurrencyError);
    });

    it("should include version info in ConcurrencyError", async () => {
      const state = createTestState("saga-1");
      await store.insert(sagaName, "corr-1", state);

      const updated: TestState = {
        ...state,
        metadata: { ...state.metadata, version: 1 },
      };

      try {
        await store.update(sagaName, updated, 5);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ConcurrencyError);
        const ce = error as ConcurrencyError;
        expect(ce.sagaId).toBe("saga-1");
        expect(ce.expectedVersion).toBe(5);
        expect(ce.actualVersion).toBe(0);
      }
    });

    it("should throw when updating non-existent saga", async () => {
      const state = createTestState("non-existent");

      await expect(store.update(sagaName, state, 0)).rejects.toThrow(
        "not found"
      );
    });

    it("should validate version increment", async () => {
      const state = createTestState("saga-1");
      await store.insert(sagaName, "corr-1", state);

      const updated: TestState = {
        ...state,
        metadata: { ...state.metadata, version: 5 }, // Should be 1
      };

      await expect(store.update(sagaName, updated, 0)).rejects.toThrow(
        "Invalid version"
      );
    });
  });

  describe("delete", () => {
    it("should delete an existing saga", async () => {
      const state = createTestState("saga-1");
      await store.insert(sagaName, "corr-1", state);

      await store.delete(sagaName, "saga-1");

      expect(store.has(sagaName, "saga-1")).toBe(false);
      expect(store.size).toBe(0);
    });

    it("should not throw when deleting non-existent saga", async () => {
      await expect(
        store.delete(sagaName, "non-existent")
      ).resolves.not.toThrow();
    });
  });

  describe("isolation between saga types", () => {
    it("should isolate different saga names", async () => {
      const state1 = createTestState("saga-1", { status: "order" });
      const state2 = createTestState("saga-1", { status: "payment" });

      await store.insert("OrderSaga", "corr-1", state1);
      await store.insert("PaymentSaga", "corr-1", state2);

      const order = await store.getById("OrderSaga", "saga-1");
      const payment = await store.getById("PaymentSaga", "saga-1");

      expect(order?.status).toBe("order");
      expect(payment?.status).toBe("payment");
      expect(store.size).toBe(2);
    });
  });

  describe("utility methods", () => {
    it("should clear all data", async () => {
      await store.insert(sagaName, "corr-1", createTestState("saga-1"));
      await store.insert(sagaName, "corr-2", createTestState("saga-2"));

      store.clear();

      expect(store.size).toBe(0);
      expect(await store.getByCorrelationId(sagaName, "corr-1")).toBeNull();
    });

    it("should return all stored states", async () => {
      await store.insert(sagaName, "corr-1", createTestState("saga-1"));
      await store.insert(sagaName, "corr-2", createTestState("saga-2"));

      const all = store.getAll();

      expect(all).toHaveLength(2);
      expect(all.map((s) => s.metadata.sagaId).sort()).toEqual([
        "saga-1",
        "saga-2",
      ]);
    });
  });
});
