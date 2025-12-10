import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MessageEnvelope, SagaPipelineContext } from "@saga-bus/core";
import {
  createIdempotencyMiddleware,
  InMemoryIdempotencyStore,
  DuplicateMessageError,
} from "../src/index.js";

function createMockEnvelope(id: string, type: string = "TestMessage"): MessageEnvelope {
  return {
    id,
    type,
    payload: { type },
    headers: {},
    timestamp: new Date(),
  };
}

function createMockContext(envelope: MessageEnvelope): SagaPipelineContext {
  return {
    envelope,
    sagaName: "TestSaga",
    correlationId: "test-correlation-123",
    metadata: {},
    setTraceContext: vi.fn(),
  };
}

describe("InMemoryIdempotencyStore", () => {
  let store: InMemoryIdempotencyStore;

  beforeEach(() => {
    store = new InMemoryIdempotencyStore(0); // Disable cleanup interval for tests
  });

  afterEach(() => {
    store.stop();
  });

  it("should return false for unknown message IDs", async () => {
    const result = await store.has("unknown-id");
    expect(result).toBe(false);
  });

  it("should return true for stored message IDs", async () => {
    await store.set("msg-1");
    const result = await store.has("msg-1");
    expect(result).toBe(true);
  });

  it("should delete message IDs", async () => {
    await store.set("msg-1");
    await store.delete("msg-1");
    const result = await store.has("msg-1");
    expect(result).toBe(false);
  });

  it("should clear all entries", async () => {
    await store.set("msg-1");
    await store.set("msg-2");
    await store.clear();
    expect(store.size).toBe(0);
  });

  it("should expire entries after TTL", async () => {
    await store.set("msg-1", 50); // 50ms TTL
    expect(await store.has("msg-1")).toBe(true);

    await new Promise((r) => setTimeout(r, 60));

    expect(await store.has("msg-1")).toBe(false);
  });

  it("should not expire entries without TTL", async () => {
    await store.set("msg-1"); // No TTL
    await new Promise((r) => setTimeout(r, 10));
    expect(await store.has("msg-1")).toBe(true);
  });
});

describe("createIdempotencyMiddleware", () => {
  let store: InMemoryIdempotencyStore;

  beforeEach(() => {
    store = new InMemoryIdempotencyStore(0);
  });

  afterEach(() => {
    store.stop();
  });

  it("should process new messages", async () => {
    const middleware = createIdempotencyMiddleware({ store });
    const envelope = createMockEnvelope("msg-1");
    const ctx = createMockContext(envelope);
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it("should skip duplicate messages by default", async () => {
    const middleware = createIdempotencyMiddleware({ store });
    const envelope = createMockEnvelope("msg-1");
    const ctx = createMockContext(envelope);
    const next = vi.fn();

    // First call - should process
    await middleware(ctx, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Second call - should skip
    next.mockClear();
    await middleware(ctx, next);
    expect(next).not.toHaveBeenCalled();
  });

  it("should mark message as processed after handler by default", async () => {
    const middleware = createIdempotencyMiddleware({ store });
    const envelope = createMockEnvelope("msg-1");
    const ctx = createMockContext(envelope);
    const next = vi.fn();

    // Check not in store before processing
    expect(await store.has("msg-1")).toBe(false);

    await middleware(ctx, next);

    // Should be in store after processing
    expect(await store.has("msg-1")).toBe(true);
  });

  it("should mark message as processed before handler when markTiming is before", async () => {
    const middleware = createIdempotencyMiddleware({
      store,
      markTiming: "before",
    });
    const envelope = createMockEnvelope("msg-1");
    const ctx = createMockContext(envelope);

    let wasInStoreBeforeNext = false;
    const next = vi.fn(async () => {
      wasInStoreBeforeNext = await store.has("msg-1");
    });

    await middleware(ctx, next);

    expect(wasInStoreBeforeNext).toBe(true);
  });

  it("should throw DuplicateMessageError when onDuplicate is throw", async () => {
    const middleware = createIdempotencyMiddleware({
      store,
      onDuplicate: "throw",
    });
    const envelope = createMockEnvelope("msg-1", "OrderCreated");
    const ctx = createMockContext(envelope);
    const next = vi.fn();

    // First call - should process
    await middleware(ctx, next);

    // Second call - should throw
    await expect(middleware(ctx, next)).rejects.toThrow(DuplicateMessageError);
    await expect(middleware(ctx, next)).rejects.toMatchObject({
      messageId: "msg-1",
      messageType: "OrderCreated",
    });
  });

  it("should log when onDuplicate is log", async () => {
    const logger = { warn: vi.fn() };
    const middleware = createIdempotencyMiddleware({
      store,
      onDuplicate: "log",
      logger,
    });
    const envelope = createMockEnvelope("msg-1");
    const ctx = createMockContext(envelope);
    const next = vi.fn();

    // First call - should process
    await middleware(ctx, next);

    // Second call - should log and skip
    next.mockClear();
    await middleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "Duplicate message detected, skipping",
      expect.objectContaining({
        messageId: "msg-1",
        messageType: "TestMessage",
        correlationId: "test-correlation-123",
        sagaName: "TestSaga",
      })
    );
  });

  it("should use custom message ID extractor", async () => {
    const middleware = createIdempotencyMiddleware({
      store,
      getMessageId: (envelope) => `${envelope.type}-${envelope.id}`,
    });
    const envelope = createMockEnvelope("msg-1", "OrderCreated");
    const ctx = createMockContext(envelope);
    const next = vi.fn();

    await middleware(ctx, next);

    // Should be stored with custom key
    expect(await store.has("OrderCreated-msg-1")).toBe(true);
    expect(await store.has("msg-1")).toBe(false);
  });

  it("should exclude specified message types from idempotency checks", async () => {
    const middleware = createIdempotencyMiddleware({
      store,
      excludeTypes: ["Heartbeat", "Ping"],
    });

    const heartbeatEnvelope = createMockEnvelope("hb-1", "Heartbeat");
    const ctx = createMockContext(heartbeatEnvelope);
    const next = vi.fn();

    // First call
    await middleware(ctx, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Second call - should NOT skip because type is excluded
    await middleware(ctx, next);
    expect(next).toHaveBeenCalledTimes(2);

    // Should not be in store
    expect(await store.has("hb-1")).toBe(false);
  });

  it("should apply TTL from windowMs option", async () => {
    const middleware = createIdempotencyMiddleware({
      store,
      windowMs: 50, // 50ms window
    });
    const envelope = createMockEnvelope("msg-1");
    const ctx = createMockContext(envelope);
    const next = vi.fn();

    // First call - should process
    await middleware(ctx, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Immediate second call - should skip
    await middleware(ctx, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Wait for TTL to expire
    await new Promise((r) => setTimeout(r, 60));

    // Third call - should process again
    await middleware(ctx, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("should propagate handler errors", async () => {
    const middleware = createIdempotencyMiddleware({ store });
    const envelope = createMockEnvelope("msg-1");
    const ctx = createMockContext(envelope);
    const next = vi.fn().mockRejectedValue(new Error("Handler failed"));

    await expect(middleware(ctx, next)).rejects.toThrow("Handler failed");
  });

  it("should still mark message after handler error with markTiming before", async () => {
    const middleware = createIdempotencyMiddleware({
      store,
      markTiming: "before",
    });
    const envelope = createMockEnvelope("msg-1");
    const ctx = createMockContext(envelope);
    const next = vi.fn().mockRejectedValue(new Error("Handler failed"));

    await expect(middleware(ctx, next)).rejects.toThrow("Handler failed");

    // Message should still be marked (at-most-once delivery)
    expect(await store.has("msg-1")).toBe(true);
  });

  it("should not mark message after handler error with markTiming after", async () => {
    const middleware = createIdempotencyMiddleware({
      store,
      markTiming: "after",
    });
    const envelope = createMockEnvelope("msg-1");
    const ctx = createMockContext(envelope);
    const next = vi.fn().mockRejectedValue(new Error("Handler failed"));

    await expect(middleware(ctx, next)).rejects.toThrow("Handler failed");

    // Message should NOT be marked (at-least-once delivery allows retry)
    expect(await store.has("msg-1")).toBe(false);
  });

  it("should handle different messages with different IDs", async () => {
    const middleware = createIdempotencyMiddleware({ store });
    const next = vi.fn();

    // Process three different messages
    await middleware(createMockContext(createMockEnvelope("msg-1")), next);
    await middleware(createMockContext(createMockEnvelope("msg-2")), next);
    await middleware(createMockContext(createMockEnvelope("msg-3")), next);

    expect(next).toHaveBeenCalledTimes(3);
  });
});

describe("DuplicateMessageError", () => {
  it("should have correct properties", () => {
    const error = new DuplicateMessageError("msg-123", "OrderCreated");

    expect(error.name).toBe("DuplicateMessageError");
    expect(error.messageId).toBe("msg-123");
    expect(error.messageType).toBe("OrderCreated");
    expect(error.message).toContain("msg-123");
    expect(error.message).toContain("OrderCreated");
  });

  it("should be instanceof Error", () => {
    const error = new DuplicateMessageError("msg-123", "OrderCreated");
    expect(error).toBeInstanceOf(Error);
  });
});
