import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Registry } from "prom-client";
import type { MessageEnvelope, SagaPipelineContext, SagaState } from "@saga-bus/core";
import {
  createMetricsMiddleware,
  createMetricsMiddlewareWithMetrics,
} from "../src/MetricsMiddleware.js";

function createEnvelope(
  type: string,
  payload: Record<string, unknown> = {}
): MessageEnvelope {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    type,
    payload: { type, ...payload },
    headers: {},
    timestamp: new Date(),
  };
}

function createContext(
  envelope: MessageEnvelope,
  sagaName = "TestSaga",
  correlationId = "corr-123",
  existingState?: SagaState | null
): SagaPipelineContext {
  return {
    envelope,
    sagaName,
    correlationId,
    sagaId: existingState?.metadata.sagaId,
    existingState,
    preState: undefined,
    postState: undefined,
    handlerResult: undefined,
    metadata: {},
    error: undefined,
    setTraceContext: () => {},
  };
}

function createSagaState(
  sagaId: string,
  isCompleted = false
): SagaState {
  return {
    metadata: {
      sagaId,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isCompleted,
    },
  };
}

describe("MetricsMiddleware", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
  });

  afterEach(() => {
    registry.clear();
  });

  describe("createMetricsMiddleware", () => {
    it("should record successful message processing", async () => {
      const middleware = createMetricsMiddleware({ registry });

      const envelope = createEnvelope("OrderSubmitted", { orderId: "123" });
      const ctx = createContext(envelope);

      await middleware(ctx, async () => {});

      const metrics = await registry.getMetricsAsJSON();
      const processedMetric = metrics.find(
        (m) => m.name === "saga_bus_messages_processed_total"
      );
      expect(processedMetric).toBeDefined();
      expect(processedMetric!.values).toHaveLength(1);
      expect(processedMetric!.values[0].value).toBe(1);
      expect(processedMetric!.values[0].labels).toEqual({
        message_type: "OrderSubmitted",
        saga_name: "TestSaga",
      });
    });

    it("should record message processing duration", async () => {
      const middleware = createMetricsMiddleware({ registry });

      const envelope = createEnvelope("SlowEvent");
      const ctx = createContext(envelope);

      await middleware(ctx, async () => {
        // Simulate some processing time
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const metrics = await registry.getMetricsAsJSON();
      const durationMetric = metrics.find(
        (m) => m.name === "saga_bus_message_processing_duration_ms"
      );
      expect(durationMetric).toBeDefined();
      // Histogram has multiple bucket values plus sum and count
      expect(durationMetric!.values.length).toBeGreaterThan(0);
    });

    it("should record failed message processing", async () => {
      const middleware = createMetricsMiddleware({ registry });

      const envelope = createEnvelope("FailingEvent");
      const ctx = createContext(envelope);

      await expect(
        middleware(ctx, async () => {
          throw new Error("Processing failed");
        })
      ).rejects.toThrow("Processing failed");

      const metrics = await registry.getMetricsAsJSON();
      const failedMetric = metrics.find(
        (m) => m.name === "saga_bus_messages_failed_total"
      );
      expect(failedMetric).toBeDefined();
      expect(failedMetric!.values).toHaveLength(1);
      expect(failedMetric!.values[0].value).toBe(1);
      expect(failedMetric!.values[0].labels).toMatchObject({
        message_type: "FailingEvent",
        saga_name: "TestSaga",
        error_type: "Error",
      });
    });

    it("should track saga creation for new sagas", async () => {
      const middleware = createMetricsMiddleware({ registry });

      const envelope = createEnvelope("OrderSubmitted");
      const ctx = createContext(envelope, "OrderSaga", "order-123", null);

      // Simulate saga being created
      await middleware(ctx, async () => {
        ctx.postState = createSagaState("saga-001");
      });

      const metrics = await registry.getMetricsAsJSON();
      const createdMetric = metrics.find(
        (m) => m.name === "saga_bus_sagas_created_total"
      );
      expect(createdMetric).toBeDefined();
      expect(createdMetric!.values).toHaveLength(1);
      expect(createdMetric!.values[0].value).toBe(1);
      expect(createdMetric!.values[0].labels).toEqual({
        saga_name: "OrderSaga",
        message_type: "OrderSubmitted",
      });
    });

    it("should not track saga creation for existing sagas", async () => {
      const middleware = createMetricsMiddleware({ registry });

      const existingState = createSagaState("saga-001");
      const envelope = createEnvelope("PaymentReceived");
      const ctx = createContext(envelope, "OrderSaga", "order-123", existingState);

      await middleware(ctx, async () => {
        ctx.postState = createSagaState("saga-001");
      });

      const metrics = await registry.getMetricsAsJSON();
      const createdMetric = metrics.find(
        (m) => m.name === "saga_bus_sagas_created_total"
      );
      // No saga created counter should exist
      expect(createdMetric?.values ?? []).toHaveLength(0);
    });

    it("should track saga completion", async () => {
      const middleware = createMetricsMiddleware({ registry });

      const existingState = createSagaState("saga-001");
      const envelope = createEnvelope("OrderShipped");
      const ctx = createContext(envelope, "OrderSaga", "order-123", existingState);

      await middleware(ctx, async () => {
        ctx.postState = createSagaState("saga-001", true); // Completed
      });

      const metrics = await registry.getMetricsAsJSON();
      const completedMetric = metrics.find(
        (m) => m.name === "saga_bus_sagas_completed_total"
      );
      expect(completedMetric).toBeDefined();
      expect(completedMetric!.values).toHaveLength(1);
      expect(completedMetric!.values[0].value).toBe(1);
      expect(completedMetric!.values[0].labels).toEqual({
        saga_name: "OrderSaga",
      });
    });

    it("should use custom prefix", async () => {
      const middleware = createMetricsMiddleware({
        registry,
        prefix: "myapp",
      });

      const envelope = createEnvelope("TestEvent");
      const ctx = createContext(envelope);

      await middleware(ctx, async () => {});

      const metrics = await registry.getMetricsAsJSON();
      const processedMetric = metrics.find(
        (m) => m.name === "myapp_messages_processed_total"
      );
      expect(processedMetric).toBeDefined();
    });

    it("should use custom duration buckets", async () => {
      const customBuckets = [10, 50, 100, 500];
      const middleware = createMetricsMiddleware({
        registry,
        durationBuckets: customBuckets,
      });

      const envelope = createEnvelope("TestEvent");
      const ctx = createContext(envelope);

      await middleware(ctx, async () => {});

      const metrics = await registry.getMetricsAsJSON();
      const durationMetric = metrics.find(
        (m) => m.name === "saga_bus_message_processing_duration_ms"
      );
      expect(durationMetric).toBeDefined();

      // Check that our custom buckets are used (plus +Inf)
      const bucketLabels = durationMetric!.values
        .filter((v) => v.labels.le !== undefined)
        .map((v) => Number(v.labels.le))
        .filter((v) => v !== Infinity);

      expect(bucketLabels).toEqual(expect.arrayContaining(customBuckets));
    });

    it("should not record saga labels when disabled", async () => {
      const middleware = createMetricsMiddleware({
        registry,
        recordSagaLabels: false,
      });

      const envelope = createEnvelope("TestEvent");
      const ctx = createContext(envelope);

      await middleware(ctx, async () => {});

      const metrics = await registry.getMetricsAsJSON();
      const processedMetric = metrics.find(
        (m) => m.name === "saga_bus_messages_processed_total"
      );
      expect(processedMetric).toBeDefined();
      expect(processedMetric!.values[0].labels).toEqual({
        message_type: "TestEvent",
      });
      expect(processedMetric!.values[0].labels).not.toHaveProperty("saga_name");
    });

    it("should record duration even on failure", async () => {
      const middleware = createMetricsMiddleware({ registry });

      const envelope = createEnvelope("FailingEvent");
      const ctx = createContext(envelope);

      await expect(
        middleware(ctx, async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          throw new Error("Failed");
        })
      ).rejects.toThrow();

      const metrics = await registry.getMetricsAsJSON();
      const durationMetric = metrics.find(
        (m) => m.name === "saga_bus_message_processing_duration_ms"
      );
      expect(durationMetric).toBeDefined();
      expect(durationMetric!.values.length).toBeGreaterThan(0);
    });

    it("should handle multiple messages of different types", async () => {
      const middleware = createMetricsMiddleware({ registry });

      // Process multiple different message types
      const types = ["TypeA", "TypeB", "TypeA", "TypeC"];
      for (const type of types) {
        const envelope = createEnvelope(type);
        const ctx = createContext(envelope);
        await middleware(ctx, async () => {});
      }

      const metrics = await registry.getMetricsAsJSON();
      const processedMetric = metrics.find(
        (m) => m.name === "saga_bus_messages_processed_total"
      );
      expect(processedMetric).toBeDefined();

      // Should have 3 distinct label combinations
      expect(processedMetric!.values).toHaveLength(3);

      // TypeA should have count of 2
      const typeAValue = processedMetric!.values.find(
        (v) => v.labels.message_type === "TypeA"
      );
      expect(typeAValue!.value).toBe(2);
    });
  });

  describe("createMetricsMiddlewareWithMetrics", () => {
    it("should return both middleware and metrics objects", async () => {
      const { middleware, metrics } = createMetricsMiddlewareWithMetrics({
        registry,
      });

      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe("function");
      expect(metrics).toBeDefined();
      expect(metrics.messagesProcessed).toBeDefined();
      expect(metrics.messagesFailed).toBeDefined();
      expect(metrics.processingDuration).toBeDefined();
      expect(metrics.sagasCreated).toBeDefined();
      expect(metrics.sagasCompleted).toBeDefined();
    });

    it("should allow direct access to metric values", async () => {
      const { middleware, metrics } = createMetricsMiddlewareWithMetrics({
        registry,
      });

      const envelope = createEnvelope("DirectAccessEvent");
      const ctx = createContext(envelope);

      await middleware(ctx, async () => {});

      const metricValue = await metrics.messagesProcessed.get();
      expect(metricValue.values).toHaveLength(1);
      expect(metricValue.values[0].value).toBe(1);
    });
  });

  describe("default registry", () => {
    it("should use default registry when none provided", async () => {
      // Create middleware without explicit registry
      const middleware = createMetricsMiddleware();

      const envelope = createEnvelope("DefaultRegistryEvent");
      const ctx = createContext(envelope);

      // Should not throw
      await expect(middleware(ctx, async () => {})).resolves.not.toThrow();
    });
  });
});
