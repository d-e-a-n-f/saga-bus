import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { SagaState, SagaStateMetadata } from "@saga-bus/core";
import { ConcurrencyError } from "@saga-bus/core";
import { PostgresSagaStore } from "../src/PostgresSagaStore.js";
import { createSchema } from "../src/schema.js";

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

describe("PostgresSagaStore", () => {
  let container: StartedPostgreSqlContainer | undefined;
  let pool: Pool | undefined;
  let store: PostgresSagaStore<TestState>;
  const sagaName = "TestSaga";

  beforeAll(async () => {
    // Start PostgreSQL container (may take 30-60s on first run)
    container = await new PostgreSqlContainer("postgres:15")
      .withDatabase("test_db")
      .withUsername("test_user")
      .withPassword("test_pass")
      .start();

    pool = new Pool({
      connectionString: container.getConnectionUri(),
    });

    // Create schema
    await createSchema(pool);
  }, 60_000); // 60s timeout for container startup

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  beforeEach(async () => {
    if (!pool) throw new Error("Pool not initialized");
    // Clean table between tests
    await pool.query("TRUNCATE saga_instances");
    store = new PostgresSagaStore<TestState>({ pool });
  });

  describe("insert", () => {
    it("should insert a new saga", async () => {
      const state = createTestState("saga-1");

      await store.insert(sagaName, "order-1", state);

      const retrieved = await store.getById(sagaName, "saga-1");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.orderId).toBe("saga-1");
    });

    it("should fail on duplicate insert", async () => {
      const state = createTestState("saga-1");

      await store.insert(sagaName, "order-1", state);

      await expect(
        store.insert(sagaName, "order-1", state)
      ).rejects.toThrow();
    });
  });

  describe("getById", () => {
    it("should retrieve an existing saga", async () => {
      const state = createTestState("saga-1", { status: "active" });
      await store.insert(sagaName, "order-1", state);

      const retrieved = await store.getById(sagaName, "saga-1");

      expect(retrieved?.status).toBe("active");
    });

    it("should return null for non-existent saga", async () => {
      const retrieved = await store.getById(sagaName, "non-existent");
      expect(retrieved).toBeNull();
    });

    it("should parse dates correctly", async () => {
      const state = createTestState("saga-1");
      await store.insert(sagaName, "order-1", state);

      const retrieved = await store.getById(sagaName, "saga-1");

      expect(retrieved?.metadata.createdAt).toBeInstanceOf(Date);
      expect(retrieved?.metadata.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("getByCorrelationId", () => {
    it("should retrieve saga by correlation ID", async () => {
      const state = createTestState("saga-1");
      await store.insert(sagaName, "order-123", state);

      const retrieved = await store.getByCorrelationId(sagaName, "order-123");

      expect(retrieved?.metadata.sagaId).toBe("saga-1");
    });

    it("should return null for non-existent correlation", async () => {
      const retrieved = await store.getByCorrelationId(sagaName, "non-existent");
      expect(retrieved).toBeNull();
    });
  });

  describe("update", () => {
    it("should update an existing saga", async () => {
      const state = createTestState("saga-1");
      await store.insert(sagaName, "order-1", state);

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
      await store.insert(sagaName, "order-1", state);

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
      await store.insert(sagaName, "order-1", state);

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
      // Insert multiple sagas
      for (let i = 0; i < 5; i++) {
        await store.insert(
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
      await store.insert(
        sagaName,
        "order-1",
        createTestState("saga-1")
      );
      await store.insert(
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
      await store.insert(sagaName, "order-1", createTestState("saga-1"));
      await store.insert(sagaName, "order-2", createTestState("saga-2"));

      const count = await store.countByName(sagaName);
      expect(count).toBe(2);
    });
  });

  describe("deleteCompletedBefore", () => {
    it("should delete old completed sagas", async () => {
      const oldDate = new Date("2020-01-01");
      const newDate = new Date();

      // Old completed saga
      await store.insert(
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

      // New completed saga
      await store.insert(
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

      // Pending saga
      await store.insert(
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
      await store.insert("OrderSaga", "order-1", createTestState("saga-1"));
      await store.insert("PaymentSaga", "order-1", createTestState("saga-1"));

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
