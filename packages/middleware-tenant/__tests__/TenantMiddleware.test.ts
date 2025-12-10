import { describe, it, expect } from "vitest";
import type { MessageEnvelope, SagaPipelineContext } from "@saga-bus/core";
import {
  createTenantMiddleware,
  createTenantPublisher,
  getTenantId,
  getTenantInfo,
  requireTenantId,
  TenantResolutionError,
  TenantNotAllowedError,
} from "../src/index.js";

function createEnvelope(
  type: string,
  headers: Record<string, string> = {},
  partitionKey?: string
): MessageEnvelope {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    type,
    payload: { type },
    headers,
    timestamp: new Date(),
    partitionKey,
  };
}

function createContext(
  envelope: MessageEnvelope,
  overrides: Partial<SagaPipelineContext> = {}
): SagaPipelineContext {
  return {
    envelope,
    sagaName: "TestSaga",
    correlationId: "corr-123",
    sagaId: undefined,
    preState: undefined,
    postState: undefined,
    handlerResult: undefined,
    metadata: {},
    error: undefined,
    ...overrides,
  };
}

describe("TenantMiddleware", () => {
  describe("header strategy", () => {
    it("should resolve tenant from header", async () => {
      const middleware = createTenantMiddleware({ strategy: "header" });

      const envelope = createEnvelope("TestEvent", { "x-tenant-id": "tenant1" });
      const ctx = createContext(envelope);

      let capturedTenantId: string | undefined;
      await middleware(ctx, async () => {
        capturedTenantId = getTenantId();
      });

      expect(capturedTenantId).toBe("tenant1");
    });

    it("should use custom header name", async () => {
      const middleware = createTenantMiddleware({
        strategy: "header",
        headerName: "x-organization-id",
      });

      const envelope = createEnvelope("TestEvent", {
        "x-organization-id": "org1",
      });
      const ctx = createContext(envelope);

      let capturedTenantId: string | undefined;
      await middleware(ctx, async () => {
        capturedTenantId = getTenantId();
      });

      expect(capturedTenantId).toBe("org1");
    });

    it("should throw when tenant required but not found", async () => {
      const middleware = createTenantMiddleware({ required: true });

      const envelope = createEnvelope("TestEvent");
      const ctx = createContext(envelope);

      await expect(middleware(ctx, async () => {})).rejects.toThrow(
        TenantResolutionError
      );
    });

    it("should use default tenant when not required", async () => {
      const middleware = createTenantMiddleware({
        required: false,
        defaultTenantId: "default-tenant",
      });

      const envelope = createEnvelope("TestEvent");
      const ctx = createContext(envelope);

      let capturedTenantId: string | undefined;
      await middleware(ctx, async () => {
        capturedTenantId = getTenantId();
      });

      expect(capturedTenantId).toBe("default-tenant");
    });

    it("should proceed without tenant context when not required and no default", async () => {
      const middleware = createTenantMiddleware({
        required: false,
      });

      const envelope = createEnvelope("TestEvent");
      const ctx = createContext(envelope);

      let capturedTenantId: string | undefined;
      let handlerCalled = false;
      await middleware(ctx, async () => {
        handlerCalled = true;
        capturedTenantId = getTenantId();
      });

      expect(handlerCalled).toBe(true);
      expect(capturedTenantId).toBeUndefined();
    });
  });

  describe("correlation-prefix strategy", () => {
    it("should resolve tenant from partition key prefix", async () => {
      const middleware = createTenantMiddleware({
        strategy: "correlation-prefix",
      });

      const envelope = createEnvelope("TestEvent", {}, "tenant1:order-123");
      const ctx = createContext(envelope);

      let capturedTenantId: string | undefined;
      await middleware(ctx, async () => {
        capturedTenantId = getTenantId();
      });

      expect(capturedTenantId).toBe("tenant1");
    });

    it("should use custom separator", async () => {
      const middleware = createTenantMiddleware({
        strategy: "correlation-prefix",
        correlationSeparator: "/",
      });

      const envelope = createEnvelope("TestEvent", {}, "tenant1/order-123");
      const ctx = createContext(envelope);

      let capturedTenantId: string | undefined;
      await middleware(ctx, async () => {
        capturedTenantId = getTenantId();
      });

      expect(capturedTenantId).toBe("tenant1");
    });
  });

  describe("custom strategy", () => {
    it("should use custom resolver", async () => {
      const middleware = createTenantMiddleware({
        strategy: "custom",
        resolver: (envelope) => {
          const payload = envelope.payload as { tenantCode?: string };
          return payload.tenantCode;
        },
      });

      const envelope: MessageEnvelope = {
        id: "msg-1",
        type: "TestEvent",
        payload: { type: "TestEvent", tenantCode: "custom-tenant" } as {
          type: string;
          tenantCode: string;
        },
        headers: {},
        timestamp: new Date(),
      };
      const ctx = createContext(envelope);

      let capturedTenantId: string | undefined;
      await middleware(ctx, async () => {
        capturedTenantId = getTenantId();
      });

      expect(capturedTenantId).toBe("custom-tenant");
    });
  });

  describe("tenant validation", () => {
    it("should accept allowed tenants", async () => {
      const middleware = createTenantMiddleware({
        allowedTenants: ["tenant1", "tenant2"],
      });

      const envelope = createEnvelope("TestEvent", { "x-tenant-id": "tenant1" });
      const ctx = createContext(envelope);

      await expect(middleware(ctx, async () => {})).resolves.toBeUndefined();
    });

    it("should reject unknown tenants", async () => {
      const middleware = createTenantMiddleware({
        allowedTenants: ["tenant1", "tenant2"],
      });

      const envelope = createEnvelope("TestEvent", { "x-tenant-id": "unknown" });
      const ctx = createContext(envelope);

      await expect(middleware(ctx, async () => {})).rejects.toThrow(
        TenantNotAllowedError
      );
    });
  });

  describe("saga ID prefixing", () => {
    it("should prefix saga ID with tenant ID", async () => {
      const middleware = createTenantMiddleware({ prefixSagaId: true });

      const envelope = createEnvelope("TestEvent", { "x-tenant-id": "tenant1" });
      const ctx = createContext(envelope, { sagaId: "saga-123" });

      await middleware(ctx, async () => {});

      expect(ctx.sagaId).toBe("tenant1:saga-123");
    });

    it("should preserve original saga ID in context", async () => {
      const middleware = createTenantMiddleware({ prefixSagaId: true });

      const envelope = createEnvelope("TestEvent", { "x-tenant-id": "tenant1" });
      const ctx = createContext(envelope, { sagaId: "saga-123" });

      let originalId: string | undefined;
      await middleware(ctx, async () => {
        originalId = getTenantInfo()?.originalSagaId;
      });

      expect(originalId).toBe("saga-123");
    });

    it("should not prefix when disabled", async () => {
      const middleware = createTenantMiddleware({ prefixSagaId: false });

      const envelope = createEnvelope("TestEvent", { "x-tenant-id": "tenant1" });
      const ctx = createContext(envelope, { sagaId: "saga-123" });

      await middleware(ctx, async () => {});

      expect(ctx.sagaId).toBe("saga-123");
    });

    it("should not prefix when no saga ID", async () => {
      const middleware = createTenantMiddleware({ prefixSagaId: true });

      const envelope = createEnvelope("TestEvent", { "x-tenant-id": "tenant1" });
      const ctx = createContext(envelope);

      await middleware(ctx, async () => {});

      expect(ctx.sagaId).toBeUndefined();
    });
  });

  describe("tenant context", () => {
    it("should provide tenant info via getTenantInfo", async () => {
      const middleware = createTenantMiddleware();

      const envelope = createEnvelope("TestEvent", { "x-tenant-id": "tenant1" });
      const ctx = createContext(envelope, { sagaId: "saga-123" });

      let info: ReturnType<typeof getTenantInfo>;
      await middleware(ctx, async () => {
        info = getTenantInfo();
      });

      expect(info!.tenantId).toBe("tenant1");
      expect(info!.originalSagaId).toBe("saga-123");
    });

    it("should throw on requireTenantId when not in context", () => {
      expect(() => requireTenantId()).toThrow("No tenant context available");
    });
  });

  describe("createTenantPublisher", () => {
    it("should add tenant ID to message headers", () => {
      const publisher = createTenantPublisher();

      const envelope = createEnvelope("TestEvent");
      const withTenant = publisher(envelope, "tenant1");

      expect(withTenant.headers["x-tenant-id"]).toBe("tenant1");
    });

    it("should use custom header name", () => {
      const publisher = createTenantPublisher({ headerName: "x-org-id" });

      const envelope = createEnvelope("TestEvent");
      const withTenant = publisher(envelope, "org1");

      expect(withTenant.headers["x-org-id"]).toBe("org1");
    });

    it("should preserve existing headers", () => {
      const publisher = createTenantPublisher();

      const envelope = createEnvelope("TestEvent", { "x-custom": "value" });
      const withTenant = publisher(envelope, "tenant1");

      expect(withTenant.headers["x-custom"]).toBe("value");
      expect(withTenant.headers["x-tenant-id"]).toBe("tenant1");
    });
  });
});
