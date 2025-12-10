import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import type { Bus } from "@saga-bus/core";
import { sagaBusMiddleware, sagaErrorHandler } from "../src/middleware.js";
import { createHealthRouter, createReadinessRouter } from "../src/health.js";

// Mock express Router
vi.mock("express", () => ({
  Router: vi.fn(() => ({
    get: vi.fn(),
  })),
}));

describe("sagaBusMiddleware", () => {
  let mockBus: Bus;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockBus = {
      start: vi.fn(),
      stop: vi.fn(),
      publish: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as Bus;

    mockReq = {
      headers: {},
    };

    mockRes = {
      setHeader: vi.fn(),
    };

    mockNext = vi.fn();
  });

  it("should attach bus to request", () => {
    const middleware = sagaBusMiddleware({ bus: mockBus });

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.bus).toBe(mockBus);
    expect(mockNext).toHaveBeenCalled();
  });

  it("should extract correlation ID from headers", () => {
    mockReq.headers = { "x-correlation-id": "test-correlation-123" };
    const middleware = sagaBusMiddleware({ bus: mockBus });

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.correlationId).toBe("test-correlation-123");
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "x-correlation-id",
      "test-correlation-123"
    );
  });

  it("should use custom correlation ID header", () => {
    mockReq.headers = { "x-request-id": "custom-123" };
    const middleware = sagaBusMiddleware({
      bus: mockBus,
      correlationIdHeader: "x-request-id",
    });

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.correlationId).toBe("custom-123");
    expect(mockRes.setHeader).toHaveBeenCalledWith("x-request-id", "custom-123");
  });

  it("should generate correlation ID when not present", () => {
    const middleware = sagaBusMiddleware({ bus: mockBus });

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.correlationId).toBeDefined();
    expect(mockReq.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("should use custom correlation ID generator", () => {
    const customGenerator = vi.fn(() => "custom-generated-id");
    const middleware = sagaBusMiddleware({
      bus: mockBus,
      correlationIdGenerator: customGenerator,
    });

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(customGenerator).toHaveBeenCalled();
    expect(mockReq.correlationId).toBe("custom-generated-id");
  });

  it("should not generate correlation ID when disabled", () => {
    const middleware = sagaBusMiddleware({
      bus: mockBus,
      generateCorrelationId: false,
    });

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.correlationId).toBeUndefined();
    expect(mockRes.setHeader).not.toHaveBeenCalled();
  });
});

describe("sagaErrorHandler", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      correlationId: "correlation-123",
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockNext = vi.fn();
  });

  it("should handle SagaTimeoutError with 408 status", () => {
    const error = new Error("Saga timed out");
    error.name = "SagaTimeoutError";

    const handler = sagaErrorHandler();
    handler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(408);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: "Saga Timeout",
      message: "Saga timed out",
      correlationId: "correlation-123",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should handle ConcurrencyError with 409 status", () => {
    const error = new Error("Concurrency conflict");
    error.name = "ConcurrencyError";

    const handler = sagaErrorHandler();
    handler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(409);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: "Concurrency Conflict",
      message: "Concurrency conflict",
      correlationId: "correlation-123",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should pass unrecognized errors to next handler", () => {
    const error = new Error("Some other error");

    const handler = sagaErrorHandler();
    handler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith(error);
  });
});

describe("createHealthRouter", () => {
  let mockBus: Bus;

  beforeEach(() => {
    mockBus = {
      start: vi.fn(),
      stop: vi.fn(),
      publish: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as Bus;
  });

  it("should create a router", () => {
    const router = createHealthRouter({ bus: mockBus });
    expect(router).toBeDefined();
  });

  it("should use default path /health", () => {
    const router = createHealthRouter({ bus: mockBus });
    expect(router.get).toHaveBeenCalledWith("/health", expect.any(Function));
  });

  it("should use custom path", () => {
    const router = createHealthRouter({ bus: mockBus, path: "/status" });
    expect(router.get).toHaveBeenCalledWith("/status", expect.any(Function));
  });
});

describe("createReadinessRouter", () => {
  let mockBus: Bus;

  beforeEach(() => {
    mockBus = {
      start: vi.fn(),
      stop: vi.fn(),
      publish: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as Bus;
  });

  it("should create a router with /ready path by default", () => {
    const router = createReadinessRouter({ bus: mockBus });
    expect(router.get).toHaveBeenCalledWith("/ready", expect.any(Function));
  });
});

describe("health check handler", () => {
  let mockBus: Bus;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let healthHandler: (req: Request, res: Response) => Promise<void>;

  beforeEach(() => {
    mockBus = {
      start: vi.fn(),
      stop: vi.fn(),
      publish: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as Bus;

    mockReq = {};

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    // Create router and capture the handler
    const router = createHealthRouter({ bus: mockBus });
    healthHandler = (router.get as ReturnType<typeof vi.fn>).mock.calls[0][1];
  });

  it("should return healthy status when bus is available", async () => {
    await healthHandler(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "healthy",
        checks: expect.objectContaining({
          bus: { status: "pass" },
        }),
      })
    );
  });

  it("should include timestamp in response", async () => {
    await healthHandler(mockReq as Request, mockRes as Response);

    const response = (mockRes.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(response.timestamp).toBeDefined();
    expect(new Date(response.timestamp).getTime()).not.toBeNaN();
  });
});

describe("health check with custom checks", () => {
  let mockBus: Bus;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockBus = {
      start: vi.fn(),
      stop: vi.fn(),
      publish: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as Bus;

    mockReq = {};

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  it("should run additional checks and include results", async () => {
    const customCheck = vi.fn().mockResolvedValue(true);
    const router = createHealthRouter({
      bus: mockBus,
      checks: [{ name: "database", check: customCheck }],
    });

    const healthHandler = (router.get as ReturnType<typeof vi.fn>).mock.calls[0][1];
    await healthHandler(mockReq as Request, mockRes as Response);

    expect(customCheck).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "healthy",
        checks: expect.objectContaining({
          database: { status: "pass" },
        }),
      })
    );
  });

  it("should return unhealthy when custom check fails", async () => {
    const failingCheck = vi.fn().mockResolvedValue(false);
    const router = createHealthRouter({
      bus: mockBus,
      checks: [{ name: "database", check: failingCheck }],
    });

    const healthHandler = (router.get as ReturnType<typeof vi.fn>).mock.calls[0][1];
    await healthHandler(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(503);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "unhealthy",
        checks: expect.objectContaining({
          database: { status: "fail" },
        }),
      })
    );
  });

  it("should handle check exceptions", async () => {
    const throwingCheck = vi.fn().mockRejectedValue(new Error("DB connection failed"));
    const router = createHealthRouter({
      bus: mockBus,
      checks: [{ name: "database", check: throwingCheck }],
    });

    const healthHandler = (router.get as ReturnType<typeof vi.fn>).mock.calls[0][1];
    await healthHandler(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(503);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "unhealthy",
        checks: expect.objectContaining({
          database: {
            status: "fail",
            message: "DB connection failed",
          },
        }),
      })
    );
  });
});
