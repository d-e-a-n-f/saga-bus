import type { Context } from "hono";
import type { HealthCheckOptions, HealthStatus, SagaBusEnv } from "./types.js";

/**
 * Creates a health check handler.
 */
export function createHealthHandler(options: HealthCheckOptions) {
  const { bus, checks = [] } = options;

  return async (c: Context<SagaBusEnv>) => {
    const healthStatus: HealthStatus = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // Check bus
    try {
      if (bus) {
        healthStatus.checks.bus = { status: "pass" };
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
    return c.json(healthStatus, statusCode);
  };
}

/**
 * Creates a readiness check handler (alias for health).
 */
export function createReadinessHandler(options: HealthCheckOptions) {
  return createHealthHandler(options);
}
