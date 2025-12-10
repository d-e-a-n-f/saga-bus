import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SagaPipelineContext, Logger } from "@saga-bus/core";
import { createLoggingMiddleware } from "../src/createLoggingMiddleware.js";

describe("createLoggingMiddleware", () => {
  let mockLogger: Logger;
  let logCalls: Array<{ level: string; message: string; meta?: unknown }>;

  beforeEach(() => {
    logCalls = [];
    mockLogger = {
      debug: vi.fn((message, meta) => logCalls.push({ level: "debug", message, meta })),
      info: vi.fn((message, meta) => logCalls.push({ level: "info", message, meta })),
      warn: vi.fn((message, meta) => logCalls.push({ level: "warn", message, meta })),
      error: vi.fn((message, meta) => logCalls.push({ level: "error", message, meta })),
    };
  });

  function createMockContext(
    overrides: Partial<SagaPipelineContext> = {}
  ): SagaPipelineContext {
    return {
      envelope: {
        id: "msg-123",
        type: "OrderSubmitted",
        payload: { type: "OrderSubmitted" },
        headers: { "x-trace-id": "trace-123" },
        timestamp: new Date(),
      },
      sagaName: "OrderSaga",
      correlationId: "order-1",
      metadata: {},
      ...overrides,
    };
  }

  describe("basic logging", () => {
    it("should log message received and handler events", async () => {
      const middleware = createLoggingMiddleware({
        logger: mockLogger,
        level: "debug",
      });

      const ctx = createMockContext();
      await middleware(ctx, async () => {});

      expect(mockLogger.debug).toHaveBeenCalled();
      expect(logCalls.some((c) => c.message.includes("Message received"))).toBe(true);
      expect(logCalls.some((c) => c.message.includes("Handler starting"))).toBe(true);
      expect(logCalls.some((c) => c.message.includes("Handler completed"))).toBe(true);
    });

    it("should log errors", async () => {
      const middleware = createLoggingMiddleware({
        logger: mockLogger,
        level: "debug",
      });

      const ctx = createMockContext();
      const error = new Error("Something went wrong");

      await expect(
        middleware(ctx, async () => {
          throw error;
        })
      ).rejects.toThrow("Something went wrong");

      expect(mockLogger.error).toHaveBeenCalled();
      const errorLog = logCalls.find((c) => c.level === "error");
      expect(errorLog?.meta).toMatchObject({
        error: "Something went wrong",
        errorType: "Error",
      });
    });
  });

  describe("level filtering", () => {
    it("should filter debug logs when level is info", async () => {
      const middleware = createLoggingMiddleware({
        logger: mockLogger,
        level: "info",
      });

      const ctx = createMockContext();
      await middleware(ctx, async () => {});

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it("should include info logs when level is info", async () => {
      const middleware = createLoggingMiddleware({
        logger: mockLogger,
        level: "info",
      });

      const ctx = createMockContext({
        postState: {
          metadata: {
            sagaId: "saga-1",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            isCompleted: false,
          },
        },
      });

      await middleware(ctx, async () => {});

      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe("saga lifecycle events", () => {
    it("should log saga.state.created for new sagas", async () => {
      const middleware = createLoggingMiddleware({
        logger: mockLogger,
        level: "info",
      });

      const ctx = createMockContext({
        preState: undefined,
        postState: {
          metadata: {
            sagaId: "saga-1",
            version: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            isCompleted: false,
          },
        },
      });

      await middleware(ctx, async () => {});

      const createLog = logCalls.find(
        (c) => (c.meta as Record<string, unknown>)?.event === "saga.state.created"
      );
      expect(createLog).toBeDefined();
    });

    it("should log saga.state.completed when saga completes", async () => {
      const middleware = createLoggingMiddleware({
        logger: mockLogger,
        level: "info",
      });

      const ctx = createMockContext({
        preState: {
          metadata: {
            sagaId: "saga-1",
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            isCompleted: false,
          },
        },
        postState: {
          metadata: {
            sagaId: "saga-1",
            version: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
            isCompleted: true, // Now completed
          },
        },
      });

      await middleware(ctx, async () => {});

      const completeLog = logCalls.find(
        (c) => (c.meta as Record<string, unknown>)?.event === "saga.state.completed"
      );
      expect(completeLog).toBeDefined();
    });
  });

  describe("options", () => {
    it("should include payload when logPayload is true", async () => {
      const middleware = createLoggingMiddleware({
        logger: mockLogger,
        level: "debug",
        logPayload: true,
      });

      const ctx = createMockContext();
      await middleware(ctx, async () => {});

      const receivedLog = logCalls.find((c) => c.message.includes("received"));
      expect((receivedLog?.meta as Record<string, unknown>)?.payload).toBeDefined();
    });

    it("should not include payload when logPayload is false", async () => {
      const middleware = createLoggingMiddleware({
        logger: mockLogger,
        level: "debug",
        logPayload: false,
      });

      const ctx = createMockContext();
      await middleware(ctx, async () => {});

      const receivedLog = logCalls.find((c) => c.message.includes("received"));
      expect((receivedLog?.meta as Record<string, unknown>)?.payload).toBeUndefined();
    });

    it("should include state when logState is true", async () => {
      const middleware = createLoggingMiddleware({
        logger: mockLogger,
        level: "info",
        logState: true,
      });

      const postState = {
        metadata: {
          sagaId: "saga-1",
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          isCompleted: false,
        },
        orderId: "order-1",
      };

      const ctx = createMockContext({ postState });
      await middleware(ctx, async () => {});

      const stateLog = logCalls.find(
        (c) => (c.meta as Record<string, unknown>)?.state !== undefined
      );
      expect(stateLog).toBeDefined();
    });

    it("should use custom filter", async () => {
      const middleware = createLoggingMiddleware({
        logger: mockLogger,
        level: "debug",
        filter: (eventType) => eventType !== "saga.handler.start",
      });

      const ctx = createMockContext();
      await middleware(ctx, async () => {});

      expect(logCalls.some((c) => c.message.includes("Handler starting"))).toBe(false);
      expect(logCalls.some((c) => c.message.includes("Message received"))).toBe(true);
    });

    it("should use custom metadata enricher", async () => {
      const middleware = createLoggingMiddleware({
        logger: mockLogger,
        level: "debug",
        enrichMeta: (meta) => ({
          ...meta,
          environment: "test",
          service: "order-service",
        }),
      });

      const ctx = createMockContext();
      await middleware(ctx, async () => {});

      const enrichedLog = logCalls.find(
        (c) => (c.meta as Record<string, unknown>)?.environment === "test"
      );
      expect(enrichedLog).toBeDefined();
      expect((enrichedLog?.meta as Record<string, unknown>)?.service).toBe("order-service");
    });
  });

  describe("duration tracking", () => {
    it("should include duration in success logs", async () => {
      const middleware = createLoggingMiddleware({
        logger: mockLogger,
        level: "debug",
      });

      const ctx = createMockContext();
      await middleware(ctx, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const successLog = logCalls.find((c) => c.message.includes("completed"));
      expect((successLog?.meta as Record<string, unknown>)?.durationMs).toBeGreaterThanOrEqual(10);
    });

    it("should include duration in error logs", async () => {
      const middleware = createLoggingMiddleware({
        logger: mockLogger,
        level: "debug",
      });

      const ctx = createMockContext();

      try {
        await middleware(ctx, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          throw new Error("Test error");
        });
      } catch {
        // Expected
      }

      const errorLog = logCalls.find((c) => c.level === "error");
      expect((errorLog?.meta as Record<string, unknown>)?.durationMs).toBeGreaterThanOrEqual(10);
    });
  });
});
