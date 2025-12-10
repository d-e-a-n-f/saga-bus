import { describe, it, expect, beforeEach } from "vitest";
import type { SagaState, SagaStateMetadata } from "@saga-bus/core";
import { ConcurrencyError } from "@saga-bus/core";
import { PrismaSagaStore } from "../src/PrismaSagaStore.js";
import type { PrismaClientLike, SagaInstanceRecord } from "../src/types.js";

interface TestState extends SagaState {
  metadata: SagaStateMetadata;
  orderId: string;
  status: string;
  amount?: number;
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

/**
 * Create a mock Prisma client backed by an in-memory store.
 * This simulates Prisma behavior without requiring actual Prisma setup.
 */
function createMockPrismaClient(): PrismaClientLike & {
  _store: Map<string, SagaInstanceRecord>;
} {
  const store = new Map<string, SagaInstanceRecord>();

  // Helper to create composite key
  const key = (sagaName: string, id: string) => `${sagaName}:${id}`;

  return {
    _store: store,
    sagaInstance: {
      findUnique: async ({ where }) => {
        const { sagaName, id } = where.sagaName_id;
        return store.get(key(sagaName, id)) ?? null;
      },

      findFirst: async ({ where }) => {
        for (const record of store.values()) {
          if (
            record.sagaName === where.sagaName &&
            record.correlationId === where.correlationId
          ) {
            return record;
          }
        }
        return null;
      },

      findMany: async ({ where, orderBy, take, skip }) => {
        let records = Array.from(store.values()).filter(
          (r) => r.sagaName === where.sagaName
        );

        if (where.isCompleted !== undefined) {
          records = records.filter((r) => r.isCompleted === where.isCompleted);
        }

        // Sort by createdAt
        if (orderBy?.createdAt === "desc") {
          records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        } else {
          records.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }

        if (skip) {
          records = records.slice(skip);
        }
        if (take) {
          records = records.slice(0, take);
        }

        return records;
      },

      create: async ({ data }) => {
        const k = key(data.sagaName, data.id);
        if (store.has(k)) {
          throw new Error("Record already exists");
        }

        const record: SagaInstanceRecord = {
          id: data.id,
          sagaName: data.sagaName,
          correlationId: data.correlationId,
          version: data.version,
          isCompleted: data.isCompleted,
          state: data.state,
          createdAt: data.createdAt ?? new Date(),
          updatedAt: data.updatedAt ?? new Date(),
        };

        store.set(k, record);
        return record;
      },

      update: async ({ where, data }) => {
        const { sagaName, id } = where.sagaName_id;
        const k = key(sagaName, id);
        const record = store.get(k);
        if (!record) {
          throw new Error("Record not found");
        }

        const updated: SagaInstanceRecord = {
          ...record,
          version: data.version ?? record.version,
          isCompleted: data.isCompleted ?? record.isCompleted,
          state: data.state ?? record.state,
          updatedAt: data.updatedAt ?? new Date(),
        };

        store.set(k, updated);
        return updated;
      },

      updateMany: async ({ where, data }) => {
        const k = key(where.sagaName, where.id);
        const record = store.get(k);
        if (!record || record.version !== where.version) {
          return { count: 0 };
        }

        const updated: SagaInstanceRecord = {
          ...record,
          version: data.version ?? record.version,
          isCompleted: data.isCompleted ?? record.isCompleted,
          state: data.state ?? record.state,
          updatedAt: data.updatedAt ?? new Date(),
        };

        store.set(k, updated);
        return { count: 1 };
      },

      delete: async ({ where }) => {
        const { sagaName, id } = where.sagaName_id;
        const k = key(sagaName, id);
        const record = store.get(k);
        if (!record) {
          throw new Error("Record not found");
        }
        store.delete(k);
        return record;
      },

      deleteMany: async ({ where }) => {
        let count = 0;
        for (const [k, record] of store.entries()) {
          if (record.sagaName !== where.sagaName) continue;
          if (
            where.isCompleted !== undefined &&
            record.isCompleted !== where.isCompleted
          )
            continue;
          if (where.updatedAt?.lt && record.updatedAt >= where.updatedAt.lt)
            continue;

          store.delete(k);
          count++;
        }
        return { count };
      },

      count: async ({ where }) => {
        let count = 0;
        for (const record of store.values()) {
          if (record.sagaName !== where.sagaName) continue;
          if (
            where.isCompleted !== undefined &&
            record.isCompleted !== where.isCompleted
          )
            continue;
          count++;
        }
        return count;
      },
    },
  };
}

describe("PrismaSagaStore", () => {
  let prisma: ReturnType<typeof createMockPrismaClient>;
  let store: PrismaSagaStore<TestState>;
  const sagaName = "TestSaga";

  beforeEach(() => {
    prisma = createMockPrismaClient();
    store = new PrismaSagaStore<TestState>({ prisma });
  });

  describe("insert", () => {
    it("should insert a new saga", async () => {
      const state = createTestState("saga-1");

      await store.insertWithCorrelation(sagaName, "order-1", state);

      const retrieved = await store.getById(sagaName, "saga-1");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.orderId).toBe("saga-1");
    });

    it("should fail on duplicate insert", async () => {
      const state = createTestState("saga-1");

      await store.insertWithCorrelation(sagaName, "order-1", state);

      await expect(
        store.insertWithCorrelation(sagaName, "order-2", state)
      ).rejects.toThrow();
    });
  });

  describe("getById", () => {
    it("should retrieve an existing saga", async () => {
      const state = createTestState("saga-1", { status: "active" });
      await store.insertWithCorrelation(sagaName, "order-1", state);

      const retrieved = await store.getById(sagaName, "saga-1");

      expect(retrieved?.status).toBe("active");
    });

    it("should return null for non-existent saga", async () => {
      const retrieved = await store.getById(sagaName, "non-existent");
      expect(retrieved).toBeNull();
    });

    it("should return null for wrong saga name", async () => {
      const state = createTestState("saga-1");
      await store.insertWithCorrelation("OtherSaga", "order-1", state);

      const retrieved = await store.getById(sagaName, "saga-1");
      expect(retrieved).toBeNull();
    });
  });

  describe("getByCorrelationId", () => {
    it("should retrieve saga by correlation ID", async () => {
      const state = createTestState("saga-1");
      await store.insertWithCorrelation(sagaName, "order-123", state);

      const retrieved = await store.getByCorrelationId(sagaName, "order-123");

      expect(retrieved?.metadata.sagaId).toBe("saga-1");
    });

    it("should return null for non-existent correlation", async () => {
      const retrieved = await store.getByCorrelationId(
        sagaName,
        "non-existent"
      );
      expect(retrieved).toBeNull();
    });
  });

  describe("update", () => {
    it("should update an existing saga", async () => {
      const state = createTestState("saga-1");
      await store.insertWithCorrelation(sagaName, "order-1", state);

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
      await store.insertWithCorrelation(sagaName, "order-1", state);

      const updated: TestState = {
        ...state,
        metadata: { ...state.metadata, version: 1 },
      };

      await expect(
        store.update(sagaName, updated, 5) // Wrong version
      ).rejects.toThrow(ConcurrencyError);
    });

    it("should throw when updating non-existent saga", async () => {
      const state = createTestState("non-existent");

      await expect(store.update(sagaName, state, 0)).rejects.toThrow(
        "not found"
      );
    });
  });

  describe("delete", () => {
    it("should delete an existing saga", async () => {
      const state = createTestState("saga-1");
      await store.insertWithCorrelation(sagaName, "order-1", state);

      await store.delete(sagaName, "saga-1");

      const retrieved = await store.getById(sagaName, "saga-1");
      expect(retrieved).toBeNull();
    });

    it("should not throw when deleting non-existent saga", async () => {
      await expect(
        store.delete(sagaName, "non-existent")
      ).resolves.not.toThrow();
    });
  });

  describe("findByName", () => {
    it("should return sagas with pagination", async () => {
      for (let i = 0; i < 5; i++) {
        await store.insertWithCorrelation(
          sagaName,
          `order-${i}`,
          createTestState(`saga-${i}`)
        );
      }

      const page1 = await store.findByName(sagaName, { limit: 2, offset: 0 });
      const page2 = await store.findByName(sagaName, { limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
    });

    it("should filter by completion status", async () => {
      await store.insertWithCorrelation(
        sagaName,
        "order-1",
        createTestState("saga-1")
      );
      await store.insertWithCorrelation(
        sagaName,
        "order-2",
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

      const completed = await store.findByName(sagaName, { completed: true });
      const pending = await store.findByName(sagaName, { completed: false });

      expect(completed).toHaveLength(1);
      expect(pending).toHaveLength(1);
    });
  });

  describe("countByName", () => {
    it("should count sagas", async () => {
      await store.insertWithCorrelation(
        sagaName,
        "order-1",
        createTestState("saga-1")
      );
      await store.insertWithCorrelation(
        sagaName,
        "order-2",
        createTestState("saga-2")
      );

      const count = await store.countByName(sagaName);
      expect(count).toBe(2);
    });
  });

  describe("deleteCompletedBefore", () => {
    it("should delete old completed sagas", async () => {
      const oldDate = new Date("2020-01-01");
      const newDate = new Date();

      await store.insertWithCorrelation(
        sagaName,
        "order-1",
        createTestState("saga-1", {
          metadata: {
            sagaId: "saga-1",
            version: 0,
            createdAt: oldDate,
            updatedAt: oldDate,
            isCompleted: true,
          },
        })
      );

      await store.insertWithCorrelation(
        sagaName,
        "order-2",
        createTestState("saga-2", {
          metadata: {
            sagaId: "saga-2",
            version: 0,
            createdAt: newDate,
            updatedAt: newDate,
            isCompleted: true,
          },
        })
      );

      await store.insertWithCorrelation(
        sagaName,
        "order-3",
        createTestState("saga-3")
      );

      const deleted = await store.deleteCompletedBefore(
        sagaName,
        new Date("2021-01-01")
      );

      expect(deleted).toBe(1);

      const remaining = await store.countByName(sagaName);
      expect(remaining).toBe(2);
    });
  });

  describe("isolation between saga types", () => {
    it("should isolate different saga names", async () => {
      await store.insertWithCorrelation(
        "OrderSaga",
        "order-1",
        createTestState("saga-1")
      );
      await store.insertWithCorrelation(
        "PaymentSaga",
        "order-1",
        createTestState("saga-1")
      );

      const order = await store.getByCorrelationId("OrderSaga", "order-1");
      const payment = await store.getByCorrelationId("PaymentSaga", "order-1");

      expect(order).not.toBeNull();
      expect(payment).not.toBeNull();

      const orderCount = await store.countByName("OrderSaga");
      const paymentCount = await store.countByName("PaymentSaga");

      expect(orderCount).toBe(1);
      expect(paymentCount).toBe(1);
    });
  });
});
