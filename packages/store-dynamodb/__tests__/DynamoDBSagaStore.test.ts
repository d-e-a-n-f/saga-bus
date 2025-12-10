import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  LocalstackContainer,
  StartedLocalStackContainer,
} from "@testcontainers/localstack";
import type { SagaState, SagaStateMetadata } from "@saga-bus/core";
import { ConcurrencyError } from "@saga-bus/core";
import { DynamoDBSagaStore } from "../src/DynamoDBSagaStore.js";
import { createTable, deleteTable, getTableSchema } from "../src/schema.js";

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

describe("DynamoDBSagaStore", () => {
  let container: StartedLocalStackContainer | undefined;
  let dynamoClient: DynamoDBClient | undefined;
  let docClient: DynamoDBDocumentClient | undefined;
  let store: DynamoDBSagaStore<TestState>;
  const tableName = "test_saga_instances";
  const sagaName = "TestSaga";

  beforeAll(async () => {
    container = await new LocalstackContainer("localstack/localstack:3").start();

    dynamoClient = new DynamoDBClient({
      endpoint: container.getConnectionUri(),
      region: "us-east-1",
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    });

    docClient = DynamoDBDocumentClient.from(dynamoClient);

    // Create table
    const schema = getTableSchema(tableName);
    await createTable(dynamoClient, schema);
  }, 120_000);

  afterAll(async () => {
    if (dynamoClient) {
      try {
        await deleteTable(dynamoClient, tableName);
      } catch {
        // Ignore
      }
    }
    await container?.stop();
  });

  beforeEach(async () => {
    if (!docClient) throw new Error("DocClient not initialized");
    store = new DynamoDBSagaStore<TestState>({
      client: docClient,
      tableName,
    });

    // Clean up all items (scan and delete)
    const { items } = await store.findByName(sagaName, { limit: 1000 });
    for (const item of items) {
      await store.delete(sagaName, item.metadata.sagaId);
    }
    // Also clean other saga types used in tests
    const { items: orderItems } = await store.findByName("OrderSaga", { limit: 1000 });
    for (const item of orderItems) {
      await store.delete("OrderSaga", item.metadata.sagaId);
    }
    const { items: paymentItems } = await store.findByName("PaymentSaga", { limit: 1000 });
    for (const item of paymentItems) {
      await store.delete("PaymentSaga", item.metadata.sagaId);
    }
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

    it("should return null for non-existent correlation ID", async () => {
      const retrieved = await store.getByCorrelationId(sagaName, "non-existent");
      expect(retrieved).toBeNull();
    });
  });

  describe("update", () => {
    it("should update an existing saga", async () => {
      const state = createTestState("saga-1");
      await store.insert(sagaName, state);

      const updated: TestState = {
        ...state,
        metadata: { ...state.metadata, version: 1, updatedAt: new Date() },
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
        metadata: { ...state.metadata, version: 1, updatedAt: new Date() },
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

      const page1 = await store.findByName(sagaName, { limit: 2 });
      expect(page1.items).toHaveLength(2);

      if (page1.lastKey) {
        const page2 = await store.findByName(sagaName, {
          limit: 2,
          startKey: page1.lastKey,
        });
        expect(page2.items).toHaveLength(2);
      }
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

      expect(active.items).toHaveLength(1);
      expect(completed.items).toHaveLength(1);
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

      const orderResult = await store.findByName("OrderSaga");
      const paymentResult = await store.findByName("PaymentSaga");

      expect(orderResult.items).toHaveLength(1);
      expect(paymentResult.items).toHaveLength(1);
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
