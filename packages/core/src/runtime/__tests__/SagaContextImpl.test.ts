import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SagaContextImpl } from "../SagaContextImpl.js";
import type { MessageEnvelope, Transport, SagaStateMetadata } from "../../types/index.js";

// Mock transport
const createMockTransport = (): Transport => ({
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockResolvedValue(undefined),
  publish: vi.fn().mockResolvedValue(undefined),
});

const createMockEnvelope = (): MessageEnvelope => ({
  id: "msg-123",
  type: "TestMessage",
  payload: { type: "TestMessage" },
  headers: {},
  timestamp: new Date(),
});

describe("SagaContextImpl", () => {
  let transport: Transport;

  beforeEach(() => {
    transport = createMockTransport();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("setTimeout", () => {
    it("should set a pending timeout change", () => {
      const ctx = new SagaContextImpl({
        sagaName: "TestSaga",
        sagaId: "saga-123",
        correlationId: "corr-123",
        envelope: createMockEnvelope(),
        transport,
      });

      ctx.setTimeout(60000); // 1 minute

      const pending = ctx.pendingTimeoutChange;
      expect(pending).toBeDefined();
      expect(pending?.type).toBe("set");
      expect(pending?.timeoutMs).toBe(60000);
      expect(pending?.timeoutExpiresAt).toEqual(new Date("2024-01-01T12:01:00Z"));
    });

    it("should throw if delay is not positive", () => {
      const ctx = new SagaContextImpl({
        sagaName: "TestSaga",
        sagaId: "saga-123",
        correlationId: "corr-123",
        envelope: createMockEnvelope(),
        transport,
      });

      expect(() => ctx.setTimeout(0)).toThrow("Timeout delay must be positive");
      expect(() => ctx.setTimeout(-1000)).toThrow("Timeout delay must be positive");
    });

    it("should overwrite previous timeout setting", () => {
      const ctx = new SagaContextImpl({
        sagaName: "TestSaga",
        sagaId: "saga-123",
        correlationId: "corr-123",
        envelope: createMockEnvelope(),
        transport,
      });

      ctx.setTimeout(60000);
      ctx.setTimeout(120000); // Reset to 2 minutes

      const pending = ctx.pendingTimeoutChange;
      expect(pending?.timeoutMs).toBe(120000);
      expect(pending?.timeoutExpiresAt).toEqual(new Date("2024-01-01T12:02:00Z"));
    });
  });

  describe("clearTimeout", () => {
    it("should set a clear pending timeout change", () => {
      const ctx = new SagaContextImpl({
        sagaName: "TestSaga",
        sagaId: "saga-123",
        correlationId: "corr-123",
        envelope: createMockEnvelope(),
        transport,
      });

      ctx.clearTimeout();

      const pending = ctx.pendingTimeoutChange;
      expect(pending).toBeDefined();
      expect(pending?.type).toBe("clear");
    });

    it("should overwrite a previous setTimeout call", () => {
      const ctx = new SagaContextImpl({
        sagaName: "TestSaga",
        sagaId: "saga-123",
        correlationId: "corr-123",
        envelope: createMockEnvelope(),
        transport,
      });

      ctx.setTimeout(60000);
      ctx.clearTimeout();

      const pending = ctx.pendingTimeoutChange;
      expect(pending?.type).toBe("clear");
    });
  });

  describe("getTimeoutRemaining", () => {
    it("should return null when no timeout is set", () => {
      const ctx = new SagaContextImpl({
        sagaName: "TestSaga",
        sagaId: "saga-123",
        correlationId: "corr-123",
        envelope: createMockEnvelope(),
        transport,
      });

      expect(ctx.getTimeoutRemaining()).toBeNull();
    });

    it("should return remaining time from pending timeout", () => {
      const ctx = new SagaContextImpl({
        sagaName: "TestSaga",
        sagaId: "saga-123",
        correlationId: "corr-123",
        envelope: createMockEnvelope(),
        transport,
      });

      ctx.setTimeout(60000);
      expect(ctx.getTimeoutRemaining()).toBe(60000);

      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000);
      expect(ctx.getTimeoutRemaining()).toBe(30000);
    });

    it("should return 0 when timeout has expired", () => {
      const ctx = new SagaContextImpl({
        sagaName: "TestSaga",
        sagaId: "saga-123",
        correlationId: "corr-123",
        envelope: createMockEnvelope(),
        transport,
      });

      ctx.setTimeout(60000);
      vi.advanceTimersByTime(120000); // Advance 2 minutes

      expect(ctx.getTimeoutRemaining()).toBe(0);
    });

    it("should return null after clearTimeout", () => {
      const ctx = new SagaContextImpl({
        sagaName: "TestSaga",
        sagaId: "saga-123",
        correlationId: "corr-123",
        envelope: createMockEnvelope(),
        transport,
      });

      ctx.setTimeout(60000);
      ctx.clearTimeout();

      expect(ctx.getTimeoutRemaining()).toBeNull();
    });

    it("should use currentMetadata timeout when no pending change", () => {
      const currentMetadata: SagaStateMetadata = {
        sagaId: "saga-123",
        version: 1,
        createdAt: new Date("2024-01-01T11:00:00Z"),
        updatedAt: new Date("2024-01-01T11:59:00Z"),
        isCompleted: false,
        timeoutMs: 60000,
        timeoutExpiresAt: new Date("2024-01-01T12:00:30Z"), // 30 seconds from now
      };

      const ctx = new SagaContextImpl({
        sagaName: "TestSaga",
        sagaId: "saga-123",
        correlationId: "corr-123",
        envelope: createMockEnvelope(),
        transport,
        currentMetadata,
      });

      expect(ctx.getTimeoutRemaining()).toBe(30000);
    });

    it("should prefer pending timeout over currentMetadata", () => {
      const currentMetadata: SagaStateMetadata = {
        sagaId: "saga-123",
        version: 1,
        createdAt: new Date("2024-01-01T11:00:00Z"),
        updatedAt: new Date("2024-01-01T11:59:00Z"),
        isCompleted: false,
        timeoutMs: 60000,
        timeoutExpiresAt: new Date("2024-01-01T12:00:30Z"), // 30 seconds
      };

      const ctx = new SagaContextImpl({
        sagaName: "TestSaga",
        sagaId: "saga-123",
        correlationId: "corr-123",
        envelope: createMockEnvelope(),
        transport,
        currentMetadata,
      });

      ctx.setTimeout(120000); // Set new 2-minute timeout

      expect(ctx.getTimeoutRemaining()).toBe(120000);
    });
  });

  describe("updateCurrentMetadata", () => {
    it("should update the current metadata reference", () => {
      const ctx = new SagaContextImpl({
        sagaName: "TestSaga",
        sagaId: "saga-123",
        correlationId: "corr-123",
        envelope: createMockEnvelope(),
        transport,
      });

      expect(ctx.getTimeoutRemaining()).toBeNull();

      const newMetadata: SagaStateMetadata = {
        sagaId: "saga-123",
        version: 1,
        createdAt: new Date("2024-01-01T11:00:00Z"),
        updatedAt: new Date("2024-01-01T12:00:00Z"),
        isCompleted: false,
        timeoutMs: 60000,
        timeoutExpiresAt: new Date("2024-01-01T12:01:00Z"),
      };

      ctx.updateCurrentMetadata(newMetadata);

      expect(ctx.getTimeoutRemaining()).toBe(60000);
    });
  });

  describe("publish", () => {
    it("should publish message via transport", async () => {
      const ctx = new SagaContextImpl({
        sagaName: "TestSaga",
        sagaId: "saga-123",
        correlationId: "corr-123",
        envelope: createMockEnvelope(),
        transport,
      });

      await ctx.publish({ type: "TestEvent" });

      expect(transport.publish).toHaveBeenCalledWith(
        { type: "TestEvent" },
        { endpoint: "TestEvent" }
      );
    });

    it("should use default endpoint when provided", async () => {
      const ctx = new SagaContextImpl({
        sagaName: "TestSaga",
        sagaId: "saga-123",
        correlationId: "corr-123",
        envelope: createMockEnvelope(),
        transport,
        defaultEndpoint: "default-queue",
      });

      await ctx.publish({ type: "TestEvent" });

      expect(transport.publish).toHaveBeenCalledWith(
        { type: "TestEvent" },
        { endpoint: "default-queue" }
      );
    });

    it("should use explicit endpoint over default", async () => {
      const ctx = new SagaContextImpl({
        sagaName: "TestSaga",
        sagaId: "saga-123",
        correlationId: "corr-123",
        envelope: createMockEnvelope(),
        transport,
        defaultEndpoint: "default-queue",
      });

      await ctx.publish({ type: "TestEvent" }, { endpoint: "explicit-queue" });

      expect(transport.publish).toHaveBeenCalledWith(
        { type: "TestEvent" },
        { endpoint: "explicit-queue" }
      );
    });
  });

  describe("schedule", () => {
    it("should schedule message with delay", async () => {
      const ctx = new SagaContextImpl({
        sagaName: "TestSaga",
        sagaId: "saga-123",
        correlationId: "corr-123",
        envelope: createMockEnvelope(),
        transport,
      });

      await ctx.schedule({ type: "DelayedEvent" }, 5000);

      expect(transport.publish).toHaveBeenCalledWith(
        { type: "DelayedEvent" },
        { endpoint: "DelayedEvent", delayMs: 5000 }
      );
    });
  });

  describe("complete", () => {
    it("should mark context as completed", () => {
      const ctx = new SagaContextImpl({
        sagaName: "TestSaga",
        sagaId: "saga-123",
        correlationId: "corr-123",
        envelope: createMockEnvelope(),
        transport,
      });

      expect(ctx.isCompleted).toBe(false);
      ctx.complete();
      expect(ctx.isCompleted).toBe(true);
    });
  });

  describe("metadata", () => {
    it("should allow setting and getting metadata", () => {
      const ctx = new SagaContextImpl({
        sagaName: "TestSaga",
        sagaId: "saga-123",
        correlationId: "corr-123",
        envelope: createMockEnvelope(),
        transport,
      });

      ctx.setMetadata("key1", "value1");
      ctx.setMetadata("key2", { nested: true });

      expect(ctx.getMetadata("key1")).toBe("value1");
      expect(ctx.getMetadata("key2")).toEqual({ nested: true });
      expect(ctx.getMetadata("nonexistent")).toBeUndefined();
    });
  });
});
