import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MessageEnvelope, Transport, Logger } from "../../types/index.js";
import {
  RetryHandler,
  RETRY_HEADERS,
  DEFAULT_RETRY_POLICY,
  calculateDelay,
  getAttemptCount,
  getFirstSeen,
  defaultDlqNaming,
} from "../RetryHandler.js";

describe("RetryHandler", () => {
  describe("calculateDelay", () => {
    it("should calculate linear backoff", () => {
      const policy = { ...DEFAULT_RETRY_POLICY, backoff: "linear" as const };

      expect(calculateDelay(policy, 1)).toBe(1000);
      expect(calculateDelay(policy, 2)).toBe(2000);
      expect(calculateDelay(policy, 3)).toBe(3000);
    });

    it("should calculate exponential backoff", () => {
      const policy = { ...DEFAULT_RETRY_POLICY, backoff: "exponential" as const };

      expect(calculateDelay(policy, 1)).toBe(1000); // 1000 * 2^0
      expect(calculateDelay(policy, 2)).toBe(2000); // 1000 * 2^1
      expect(calculateDelay(policy, 3)).toBe(4000); // 1000 * 2^2
      expect(calculateDelay(policy, 4)).toBe(8000); // 1000 * 2^3
    });

    it("should cap at maxDelayMs", () => {
      const policy = {
        ...DEFAULT_RETRY_POLICY,
        backoff: "exponential" as const,
        maxDelayMs: 5000,
      };

      expect(calculateDelay(policy, 5)).toBe(5000); // Would be 16000, capped at 5000
    });
  });

  describe("getAttemptCount", () => {
    it("should return 1 for first attempt", () => {
      const envelope = createMockEnvelope({});
      expect(getAttemptCount(envelope)).toBe(1);
    });

    it("should extract attempt from headers", () => {
      const envelope = createMockEnvelope({
        headers: { [RETRY_HEADERS.ATTEMPT]: "3" },
      });
      expect(getAttemptCount(envelope)).toBe(3);
    });
  });

  describe("getFirstSeen", () => {
    it("should return timestamp for first attempt", () => {
      const timestamp = new Date("2024-01-01T12:00:00Z");
      const envelope = createMockEnvelope({ timestamp });

      expect(getFirstSeen(envelope)).toEqual(timestamp);
    });

    it("should extract first-seen from headers", () => {
      const firstSeen = "2024-01-01T10:00:00Z";
      const envelope = createMockEnvelope({
        headers: { [RETRY_HEADERS.FIRST_SEEN]: firstSeen },
      });

      expect(getFirstSeen(envelope)).toEqual(new Date(firstSeen));
    });
  });

  describe("defaultDlqNaming", () => {
    it("should append .dlq to endpoint", () => {
      expect(defaultDlqNaming("OrderSubmitted")).toBe("OrderSubmitted.dlq");
      expect(defaultDlqNaming("payments.received")).toBe("payments.received.dlq");
    });
  });

  describe("RetryHandler", () => {
    let handler: RetryHandler;
    let mockTransport: { publish: ReturnType<typeof vi.fn> };
    let mockLogger: Logger;

    beforeEach(() => {
      mockTransport = {
        publish: vi.fn().mockResolvedValue(undefined),
      };

      mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      handler = new RetryHandler({
        transport: mockTransport as unknown as Transport,
        logger: mockLogger,
        defaultPolicy: DEFAULT_RETRY_POLICY,
        dlqNaming: defaultDlqNaming,
      });
    });

    describe("handleFailure", () => {
      it("should retry when attempts remain", async () => {
        const envelope = createMockEnvelope({
          headers: { [RETRY_HEADERS.ATTEMPT]: "1" },
        });

        const result = await handler.handleFailure(
          envelope,
          "test.endpoint",
          new Error("Test error")
        );

        expect(result).toBe(true);
        expect(mockTransport.publish).toHaveBeenCalledWith(
          envelope.payload,
          expect.objectContaining({
            endpoint: "test.endpoint",
            headers: expect.objectContaining({
              [RETRY_HEADERS.ATTEMPT]: "2",
            }),
            delayMs: expect.any(Number),
          })
        );
      });

      it("should send to DLQ when max attempts exceeded", async () => {
        const envelope = createMockEnvelope({
          headers: { [RETRY_HEADERS.ATTEMPT]: "3" }, // At max (default is 3)
        });

        const result = await handler.handleFailure(
          envelope,
          "test.endpoint",
          new Error("Test error")
        );

        expect(result).toBe(false);
        expect(mockTransport.publish).toHaveBeenCalledWith(
          envelope.payload,
          expect.objectContaining({
            endpoint: "test.endpoint.dlq",
          })
        );
      });

      it("should use custom retry policy", async () => {
        const envelope = createMockEnvelope({
          headers: { [RETRY_HEADERS.ATTEMPT]: "4" },
        });

        const customPolicy = { ...DEFAULT_RETRY_POLICY, maxAttempts: 5 };

        const result = await handler.handleFailure(
          envelope,
          "test.endpoint",
          new Error("Test error"),
          customPolicy
        );

        // Should retry (4 < 5)
        expect(result).toBe(true);
      });
    });

    describe("sendToDlq", () => {
      it("should include error information in headers", async () => {
        const envelope = createMockEnvelope({});
        const error = new Error("Something went wrong");
        error.name = "CustomError";

        await handler.sendToDlq(envelope, "test.endpoint", error);

        expect(mockTransport.publish).toHaveBeenCalledWith(
          envelope.payload,
          expect.objectContaining({
            endpoint: "test.endpoint.dlq",
            headers: expect.objectContaining({
              [RETRY_HEADERS.ERROR_MESSAGE]: "Something went wrong",
              [RETRY_HEADERS.ERROR_TYPE]: "CustomError",
              [RETRY_HEADERS.ORIGINAL_ENDPOINT]: "test.endpoint",
            }),
          })
        );
      });
    });
  });
});

// Helper to create mock envelopes
function createMockEnvelope(
  overrides: Partial<MessageEnvelope>
): MessageEnvelope {
  return {
    id: "msg-123",
    type: "TestMessage",
    payload: { type: "TestMessage" },
    headers: {},
    timestamp: new Date(),
    ...overrides,
  };
}
