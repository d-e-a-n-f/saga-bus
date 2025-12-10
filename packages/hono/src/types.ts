import type { Bus } from "@saga-bus/core";
import type { Env } from "hono";

export interface SagaBusEnv extends Env {
  Variables: {
    bus: Bus;
    correlationId: string;
  };
}

export interface SagaBusHonoOptions {
  /** The bus instance to attach */
  bus: Bus;

  /** Header name for correlation ID */
  correlationIdHeader?: string;

  /** Whether to generate correlation ID if not present */
  generateCorrelationId?: boolean;

  /** Custom correlation ID generator */
  correlationIdGenerator?: () => string;
}

export interface HealthCheckOptions {
  /** The bus instance to check */
  bus: Bus;

  /** Additional health checks */
  checks?: Array<{
    name: string;
    check: () => Promise<boolean>;
  }>;
}

export interface HealthStatus {
  status: "healthy" | "unhealthy";
  timestamp: string;
  checks: Record<string, {
    status: "pass" | "fail";
    message?: string;
  }>;
}
