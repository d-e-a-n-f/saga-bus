import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SpanStatusCode, SpanKind } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import type { MessageEnvelope, SagaPipelineContext } from "@saga-bus/core";
import {
  createTracingMiddleware,
  createPublishTracer,
} from "../src/TracingMiddleware.js";

function createEnvelope(
  type: string,
  payload: Record<string, unknown> = {},
  headers: Record<string, string> = {}
): MessageEnvelope {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    type,
    payload: { type, ...payload },
    headers,
    timestamp: new Date(),
  };
}

function createContext(
  envelope: MessageEnvelope,
  sagaName = "TestSaga",
  correlationId = "corr-123"
): SagaPipelineContext {
  return {
    envelope,
    sagaName,
    correlationId,
    sagaId: undefined,
    preState: undefined,
    postState: undefined,
    handlerResult: undefined,
    metadata: {},
    error: undefined,
  };
}

describe("TracingMiddleware", () => {
  let exporter: InMemorySpanExporter;
  let provider: BasicTracerProvider;

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    provider = new BasicTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
    provider.register();
  });

  afterEach(() => {
    exporter.reset();
  });

  describe("createTracingMiddleware", () => {
    it("should create spans for message handling", async () => {
      const middleware = createTracingMiddleware({
        tracer: provider.getTracer("test"),
      });

      const envelope = createEnvelope("TestEvent", { value: 42 });
      const ctx = createContext(envelope);

      await middleware(ctx, async () => {});

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);

      const span = spans[0]!;
      expect(span.name).toBe("saga-bus.handle TestEvent");
      expect(span.kind).toBe(SpanKind.CONSUMER);
      expect(span.status.code).toBe(SpanStatusCode.OK);
      expect(span.attributes["messaging.system"]).toBe("saga-bus");
      expect(span.attributes["messaging.message.type"]).toBe("TestEvent");
    });

    it("should record errors on handler failure", async () => {
      const middleware = createTracingMiddleware({
        tracer: provider.getTracer("test"),
      });

      const envelope = createEnvelope("FailEvent");
      const ctx = createContext(envelope);

      await expect(
        middleware(ctx, async () => {
          throw new Error("Handler failed");
        })
      ).rejects.toThrow("Handler failed");

      const spans = exporter.getFinishedSpans();
      const span = spans[0]!;
      expect(span.status.code).toBe(SpanStatusCode.ERROR);
      expect(span.status.message).toBe("Handler failed");
    });

    it("should include saga attributes", async () => {
      const middleware = createTracingMiddleware({
        tracer: provider.getTracer("test"),
      });

      const envelope = createEnvelope("SagaEvent");
      const ctx = createContext(envelope, "OrderSaga", "order-123");
      ctx.sagaId = "saga-instance-456";

      await middleware(ctx, async () => {});

      const span = exporter.getFinishedSpans()[0]!;
      expect(span.attributes["saga.name"]).toBe("OrderSaga");
      expect(span.attributes["saga.id"]).toBe("saga-instance-456");
      expect(span.attributes["saga.correlation_id"]).toBe("order-123");
    });

    it("should record payload when enabled", async () => {
      const middleware = createTracingMiddleware({
        tracer: provider.getTracer("test"),
        recordPayload: true,
      });

      const envelope = createEnvelope("PayloadEvent", { secret: "data" });
      const ctx = createContext(envelope);

      await middleware(ctx, async () => {});

      const span = exporter.getFinishedSpans()[0]!;
      expect(span.attributes["messaging.message.payload"]).toContain("secret");
      expect(span.attributes["messaging.message.payload"]).toContain("data");
    });

    it("should truncate large payloads", async () => {
      const middleware = createTracingMiddleware({
        tracer: provider.getTracer("test"),
        recordPayload: true,
        maxPayloadSize: 20,
      });

      const envelope = createEnvelope("LargeEvent", {
        data: "a".repeat(100),
      });
      const ctx = createContext(envelope);

      await middleware(ctx, async () => {});

      const span = exporter.getFinishedSpans()[0]!;
      const payload = span.attributes["messaging.message.payload"] as string;
      expect(payload.length).toBeLessThanOrEqual(23); // 20 + "..."
      expect(payload.endsWith("...")).toBe(true);
      expect(span.attributes["messaging.message.payload_truncated"]).toBe(true);
    });

    it("should use custom attribute extractor", async () => {
      const middleware = createTracingMiddleware({
        tracer: provider.getTracer("test"),
        attributeExtractor: (env) => ({
          "custom.attr": "value",
          "custom.type": env.type,
        }),
      });

      const envelope = createEnvelope("CustomEvent");
      const ctx = createContext(envelope);

      await middleware(ctx, async () => {});

      const span = exporter.getFinishedSpans()[0]!;
      expect(span.attributes["custom.attr"]).toBe("value");
      expect(span.attributes["custom.type"]).toBe("CustomEvent");
    });

    it("should handle attribute extractor errors gracefully", async () => {
      const middleware = createTracingMiddleware({
        tracer: provider.getTracer("test"),
        attributeExtractor: () => {
          throw new Error("Extractor failed");
        },
      });

      const envelope = createEnvelope("ErrorEvent");
      const ctx = createContext(envelope);

      // Should not throw
      await expect(middleware(ctx, async () => {})).resolves.not.toThrow();

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
    });
  });

  describe("createPublishTracer", () => {
    it("should add trace headers to published messages", () => {
      const tracer = createPublishTracer({
        tracer: provider.getTracer("test"),
      });

      const envelope = createEnvelope("PublishEvent");
      const traced = tracer(envelope);

      expect(traced.headers.traceparent).toBeDefined();
    });

    it("should create producer spans", () => {
      const tracer = createPublishTracer({
        tracer: provider.getTracer("test"),
      });

      const envelope = createEnvelope("PublishEvent");
      tracer(envelope);

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);

      const span = spans[0]!;
      expect(span.name).toBe("saga-bus.publish PublishEvent");
      expect(span.kind).toBe(SpanKind.PRODUCER);
    });

    it("should preserve existing headers", () => {
      const tracer = createPublishTracer({
        tracer: provider.getTracer("test"),
      });

      const envelope = createEnvelope("PublishEvent", {}, {
        "x-custom": "value",
      });
      const traced = tracer(envelope);

      expect(traced.headers["x-custom"]).toBe("value");
      expect(traced.headers.traceparent).toBeDefined();
    });
  });

  describe("context propagation", () => {
    it("should link child spans to parent via headers", async () => {
      const publishTracer = createPublishTracer({
        tracer: provider.getTracer("test"),
      });

      const middleware = createTracingMiddleware({
        tracer: provider.getTracer("test"),
      });

      // Simulate publish with trace context
      const envelope = createEnvelope("PropagatedEvent");
      const tracedEnvelope = publishTracer(envelope);

      // Simulate receive with trace context
      const ctx = createContext(tracedEnvelope);
      await middleware(ctx, async () => {});

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(2);

      const producerSpan = spans.find((s) => s.kind === SpanKind.PRODUCER);
      const consumerSpan = spans.find((s) => s.kind === SpanKind.CONSUMER);

      expect(producerSpan).toBeDefined();
      expect(consumerSpan).toBeDefined();

      // Consumer should have producer as parent (same trace)
      expect(consumerSpan!.spanContext().traceId).toBe(
        producerSpan!.spanContext().traceId
      );
      expect(consumerSpan!.parentSpanId).toBe(
        producerSpan!.spanContext().spanId
      );
    });
  });

  describe("global tracer fallback", () => {
    it("should use global tracer when none provided", async () => {
      const middleware = createTracingMiddleware();

      const envelope = createEnvelope("GlobalEvent");
      const ctx = createContext(envelope);

      // Should not throw even without explicit tracer
      await expect(middleware(ctx, async () => {})).resolves.not.toThrow();
    });
  });
});
