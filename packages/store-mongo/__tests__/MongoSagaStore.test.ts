import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoClient, Db } from "mongodb";
import {
  MongoDBContainer,
  StartedMongoDBContainer,
} from "@testcontainers/mongodb";
import type { SagaState, SagaStateMetadata } from "@saga-bus/core";
import { ConcurrencyError } from "@saga-bus/core";
import { MongoSagaStore } from "../src/MongoSagaStore.js";

interface TestState extends SagaState {
  metadata: SagaStateMetadata;
  orderId: string;
  status: string;
  correlationId?: string;
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
    ...overrides,
  };
}

describe("MongoSagaStore", () => {
  let container: StartedMongoDBContainer | undefined;
  let client: MongoClient | undefined;
  let db: Db | undefined;
  let store: MongoSagaStore<TestState>;
  const sagaName = "TestSaga";

  beforeAll(async () => {
    container = await new MongoDBContainer("mongo:7").start();
    client = new MongoClient(container.getConnectionString(), {
      directConnection: true,
    });
    await client.connect();
    db = client.db("test_saga_bus");
  }, 60_000);

  afterAll(async () => {
    await client?.close();
    await container?.stop();
  });

  beforeEach(async () => {
    if (!db) throw new Error("DB not initialized");
    await db.collection("saga_instances").deleteMany({});
    store = new MongoSagaStore<TestState>({ db });
    await store.ensureIndexes();
  });

  describe("insert and getById", () => {
    it("should insert and retrieve a saga", async () => {
      const state = createTestState("saga-1");
      await store.insert(sagaName, state);

      const retrieved = await store.getById(sagaName, "saga-1");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.orderId).toBe("saga-1");
    });

    it("should return null for non-existent saga", async () => {
      const retrieved = await store.getById(sagaName, "non-existent");
      expect(retrieved).toBeNull();
    });
  });

  describe("getByCorrelationId", () => {
    it("should retrieve saga by correlation ID", async () => {
      const state = createTestState("saga-1", {
        correlationId: "order-123",
      });
      await store.insert(sagaName, state);

      const retrieved = await store.getByCorrelationId(sagaName, "order-123");
      expect(retrieved?.metadata.sagaId).toBe("saga-1");
    });
  });

  describe("update", () => {
    it("should update an existing saga", async () => {
      const state = createTestState("saga-1");
      await store.insert(sagaName, state);

      const updated: TestState = {
        ...state,
        metadata: { ...state.metadata, version: 1 },
        status: "completed",
      };

      await store.update(sagaName, updated, 0);

      const retrieved = await store.getById(sagaName, "saga-1");
      expect(retrieved?.status).toBe("completed");
      expect(retrieved?.metadata.version).toBe(1);
    });

    it("should throw ConcurrencyError on version mismatch", async () => {
      const state = createTestState("saga-1");
      await store.insert(sagaName, state);

      const updated: TestState = {
        ...state,
        metadata: { ...state.metadata, version: 1 },
      };

      await expect(store.update(sagaName, updated, 5)).rejects.toThrow(
        ConcurrencyError
      );
    });
  });

  describe("delete", () => {
    it("should delete an existing saga", async () => {
      const state = createTestState("saga-1");
      await store.insert(sagaName, state);

      await store.delete(sagaName, "saga-1");

      const retrieved = await store.getById(sagaName, "saga-1");
      expect(retrieved).toBeNull();
    });
  });

  describe("findByName", () => {
    it("should return sagas with pagination", async () => {
      for (let i = 0; i < 5; i++) {
        await store.insert(sagaName, createTestState(`saga-${i}`));
      }

      const page1 = await store.findByName(sagaName, { limit: 2, offset: 0 });
      const page2 = await store.findByName(sagaName, { limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
    });

    it("should filter by completed status", async () => {
      await store.insert(sagaName, createTestState("saga-1"));
      await store.insert(
        sagaName,
        createTestState("saga-2", {
          metadata: {
            sagaId: "saga-2",
            version: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            isCompleted: true,
          },
        })
      );

      const active = await store.findByName(sagaName, { completed: false });
      const completed = await store.findByName(sagaName, { completed: true });

      expect(active).toHaveLength(1);
      expect(completed).toHaveLength(1);
    });
  });

  describe("countByName", () => {
    it("should count sagas by name", async () => {
      for (let i = 0; i < 3; i++) {
        await store.insert(sagaName, createTestState(`saga-${i}`));
      }

      const count = await store.countByName(sagaName);
      expect(count).toBe(3);
    });

    it("should filter count by completed status", async () => {
      await store.insert(sagaName, createTestState("saga-1"));
      await store.insert(
        sagaName,
        createTestState("saga-2", {
          metadata: {
            sagaId: "saga-2",
            version: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            isCompleted: true,
          },
        })
      );

      const activeCount = await store.countByName(sagaName, {
        completed: false,
      });
      const completedCount = await store.countByName(sagaName, {
        completed: true,
      });

      expect(activeCount).toBe(1);
      expect(completedCount).toBe(1);
    });
  });

  describe("deleteCompletedBefore", () => {
    it("should delete completed sagas older than date", async () => {
      const oldDate = new Date(Date.now() - 86400000); // 1 day ago
      const newDate = new Date();

      await store.insert(
        sagaName,
        createTestState("old-completed", {
          metadata: {
            sagaId: "old-completed",
            version: 0,
            createdAt: oldDate,
            updatedAt: oldDate,
            isCompleted: true,
          },
        })
      );

      await store.insert(
        sagaName,
        createTestState("new-completed", {
          metadata: {
            sagaId: "new-completed",
            version: 0,
            createdAt: newDate,
            updatedAt: newDate,
            isCompleted: true,
          },
        })
      );

      await store.insert(
        sagaName,
        createTestState("old-active", {
          metadata: {
            sagaId: "old-active",
            version: 0,
            createdAt: oldDate,
            updatedAt: oldDate,
            isCompleted: false,
          },
        })
      );

      const deleted = await store.deleteCompletedBefore(
        sagaName,
        new Date(Date.now() - 3600000)
      ); // 1 hour ago

      expect(deleted).toBe(1);

      // Verify only old-completed was deleted
      expect(await store.getById(sagaName, "old-completed")).toBeNull();
      expect(await store.getById(sagaName, "new-completed")).not.toBeNull();
      expect(await store.getById(sagaName, "old-active")).not.toBeNull();
    });
  });

  describe("isolation between saga types", () => {
    it("should isolate different saga names", async () => {
      await store.insert("OrderSaga", createTestState("saga-1"));
      await store.insert("PaymentSaga", createTestState("saga-1"));

      const orderCount = await store.countByName("OrderSaga");
      const paymentCount = await store.countByName("PaymentSaga");

      expect(orderCount).toBe(1);
      expect(paymentCount).toBe(1);
    });

    it("should allow same sagaId for different saga types", async () => {
      await store.insert("OrderSaga", createTestState("shared-id"));
      await store.insert("PaymentSaga", createTestState("shared-id"));

      const orderSaga = await store.getById("OrderSaga", "shared-id");
      const paymentSaga = await store.getById("PaymentSaga", "shared-id");

      expect(orderSaga).not.toBeNull();
      expect(paymentSaga).not.toBeNull();
    });
  });
});
