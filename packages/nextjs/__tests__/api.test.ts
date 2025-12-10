import { describe, it, expect, beforeEach, vi } from "vitest";
import { InMemoryTransport } from "@saga-bus/transport-inmemory";
import { InMemorySagaStore } from "@saga-bus/store-inmemory";
import type { SagaState, SagaStateMetadata } from "@saga-bus/core";
import { createSagaBus } from "../src/server/index.js";
import { createSagaHandler } from "../src/api/index.js";

interface TestState extends SagaState {
  metadata: SagaStateMetadata;
  orderId: string;
  status: string;
}

function createMockRequest(body: unknown): Request {
  return new Request("http://localhost/api/saga", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("createSagaHandler", () => {
  let transport: InMemoryTransport;
  let store: InMemorySagaStore<TestState>;
  let handler: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    transport = new InMemoryTransport();
    store = new InMemorySagaStore<TestState>();
    const bus = createSagaBus({ transport, store });
    handler = createSagaHandler(bus);
    vi.clearAllMocks();
  });

  describe("publish action", () => {
    it("should publish messages", async () => {
      const publishSpy = vi.spyOn(transport, "publish");

      const request = createMockRequest({
        action: "publish",
        message: {
          type: "TestEvent",
          payload: { data: "test" },
        },
      });

      const response = await handler(request);
      const data = (await response.json()) as {
        success: boolean;
        messageId: string;
      };

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.messageId).toBeDefined();
      expect(publishSpy).toHaveBeenCalled();
    });

    it("should return error when message is missing", async () => {
      const request = createMockRequest({
        action: "publish",
      });

      const response = await handler(request);
      expect(response.status).toBe(400);

      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("Message is required");
    });

    it("should include correlation ID in headers when provided", async () => {
      const publishSpy = vi.spyOn(transport, "publish");

      const request = createMockRequest({
        action: "publish",
        message: {
          type: "TestEvent",
          payload: { data: "test" },
          correlationId: "corr-123",
        },
      });

      await handler(request);

      expect(publishSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: { "x-correlation-id": "corr-123" },
        })
      );
    });
  });

  describe("getState action", () => {
    it("should return saga state", async () => {
      const testState: TestState = {
        metadata: {
          sagaId: "saga-1",
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          isCompleted: false,
        },
        orderId: "order-1",
        status: "pending",
      };

      await store.insert("TestSaga", testState);

      const request = createMockRequest({
        action: "getState",
        sagaName: "TestSaga",
        id: "saga-1",
      });

      const response = await handler(request);
      const data = (await response.json()) as { state: TestState | null };

      expect(response.status).toBe(200);
      expect(data.state?.orderId).toBe("order-1");
      expect(data.state?.status).toBe("pending");
    });

    it("should return null for non-existent saga", async () => {
      const request = createMockRequest({
        action: "getState",
        sagaName: "TestSaga",
        id: "non-existent",
      });

      const response = await handler(request);
      const data = (await response.json()) as { state: TestState | null };

      expect(response.status).toBe(200);
      expect(data.state).toBeNull();
    });

    it("should return error when sagaName is missing", async () => {
      const request = createMockRequest({
        action: "getState",
        id: "saga-1",
      });

      const response = await handler(request);
      expect(response.status).toBe(400);

      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("sagaName and id are required");
    });

    it("should return error when id is missing", async () => {
      const request = createMockRequest({
        action: "getState",
        sagaName: "TestSaga",
      });

      const response = await handler(request);
      expect(response.status).toBe(400);
    });
  });

  describe("getStateByCorrelation action", () => {
    it("should return error when sagaName or id is missing", async () => {
      const request = createMockRequest({
        action: "getStateByCorrelation",
        sagaName: "TestSaga",
      });

      const response = await handler(request);
      expect(response.status).toBe(400);

      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("sagaName and id are required");
    });
  });

  describe("unknown action", () => {
    it("should return error for unknown action", async () => {
      const request = createMockRequest({
        action: "unknownAction",
      });

      const response = await handler(request);
      expect(response.status).toBe(400);

      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("Unknown action");
    });
  });

  describe("error handling", () => {
    it("should return 500 for internal errors", async () => {
      const request = new Request("http://localhost/api/saga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json{",
      });

      const response = await handler(request);
      expect(response.status).toBe(500);

      const data = (await response.json()) as { error: string };
      expect(data.error).toBeDefined();
    });
  });
});
