import { describe, it, expect } from "vitest";
import type { SagaPipelineContext } from "../../types/index.js";
import { ConcurrencyError, TransientError } from "../../errors/index.js";
import { DefaultErrorHandler, createErrorHandler } from "../DefaultErrorHandler.js";

describe("DefaultErrorHandler", () => {
  const handler = new DefaultErrorHandler();

  const mockContext: SagaPipelineContext = {
    envelope: {
      id: "msg-1",
      type: "Test",
      payload: { type: "Test" },
      headers: {},
      timestamp: new Date(),
    },
    sagaName: "TestSaga",
    correlationId: "corr-1",
    metadata: {},
  };

  describe("handle", () => {
    it('should return "retry" for TransientError', async () => {
      const error = new TransientError("Connection failed");
      const result = await handler.handle(error, mockContext);
      expect(result).toBe("retry");
    });

    it('should return "retry" for ConcurrencyError', async () => {
      const error = new ConcurrencyError("saga-1", 1, 2);
      const result = await handler.handle(error, mockContext);
      expect(result).toBe("retry");
    });

    it('should return "retry" for network-related errors', async () => {
      const errors = [
        new Error("ECONNREFUSED"),
        new Error("Connection reset by peer"),
        new Error("ETIMEDOUT"),
        new Error("socket hang up"),
        new Error("Network error occurred"),
      ];

      for (const error of errors) {
        const result = await handler.handle(error, mockContext);
        expect(result).toBe("retry");
      }
    });

    it('should return "dlq" for other errors', async () => {
      const errors = [
        new Error("Invalid input"),
        new Error("Not found"),
        new Error("Validation failed"),
      ];

      for (const error of errors) {
        const result = await handler.handle(error, mockContext);
        expect(result).toBe("dlq");
      }
    });
  });
});

describe("createErrorHandler", () => {
  it("should use custom classifier", async () => {
    const handler = createErrorHandler({
      customClassifier: (error) => {
        if (error instanceof Error && error.message.includes("CUSTOM")) {
          return "drop";
        }
        return null;
      },
    });

    const mockContext: SagaPipelineContext = {
      envelope: {
        id: "msg-1",
        type: "Test",
        payload: { type: "Test" },
        headers: {},
        timestamp: new Date(),
      },
      sagaName: "TestSaga",
      correlationId: "corr-1",
      metadata: {},
    };

    const result = await handler.handle(new Error("CUSTOM error"), mockContext);
    expect(result).toBe("drop");
  });

  it("should use additional transient patterns", async () => {
    const handler = createErrorHandler({
      additionalTransientPatterns: [/MY_CUSTOM_TRANSIENT/],
    });

    const mockContext: SagaPipelineContext = {
      envelope: {
        id: "msg-1",
        type: "Test",
        payload: { type: "Test" },
        headers: {},
        timestamp: new Date(),
      },
      sagaName: "TestSaga",
      correlationId: "corr-1",
      metadata: {},
    };

    const result = await handler.handle(
      new Error("MY_CUSTOM_TRANSIENT occurred"),
      mockContext
    );
    expect(result).toBe("retry");
  });
});
