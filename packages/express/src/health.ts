import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import type { HealthCheckOptions } from "./types.js";

export interface HealthStatus {
  status: "healthy" | "unhealthy";
  timestamp: string;
  checks: Record<string, {
    status: "pass" | "fail";
    message?: string;
  }>;
}

/**
 * Creates a health check router for the bus.
 */
export function createHealthRouter(options: HealthCheckOptions): Router {
  const {
    bus,
    path = "/health",
    checks = [],
  } = options;

  const router = createRouter();

  router.get(path, async (_req: Request, res: Response) => {
    const healthStatus: HealthStatus = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // Check bus status
    try {
      // Simple check - bus exists and is accessible
      if (bus) {
        healthStatus.checks.bus = {
          status: "pass",
        };
      } else {
        throw new Error("Bus not available");
      }
    } catch (error) {
      healthStatus.status = "unhealthy";
      healthStatus.checks.bus = {
        status: "fail",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }

    // Run additional checks
    for (const check of checks) {
      try {
        const result = await check.check();
        healthStatus.checks[check.name] = {
          status: result ? "pass" : "fail",
        };
        if (!result) {
          healthStatus.status = "unhealthy";
        }
      } catch (error) {
        healthStatus.status = "unhealthy";
        healthStatus.checks[check.name] = {
          status: "fail",
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    const statusCode = healthStatus.status === "healthy" ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  });

  return router;
}

/**
 * Creates a readiness check router.
 */
export function createReadinessRouter(options: HealthCheckOptions): Router {
  return createHealthRouter({
    ...options,
    path: options.path ?? "/ready",
  });
}
