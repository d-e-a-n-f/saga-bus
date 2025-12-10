import type { Bus } from "@saga-bus/core";

declare module "fastify" {
  interface FastifyRequest {
    bus: Bus;
    correlationId: string;
  }
  interface FastifyInstance {
    bus: Bus;
  }
}

export interface SagaBusFastifyOptions {
  /** The bus instance to register */
  bus: Bus;

  /** Whether to start bus when Fastify starts */
  autoStart?: boolean;

  /** Whether to stop bus when Fastify closes */
  autoStop?: boolean;

  /** Header name for correlation ID */
  correlationIdHeader?: string;

  /** Whether to generate correlation ID if not present */
  generateCorrelationId?: boolean;

  /** Custom correlation ID generator */
  correlationIdGenerator?: () => string;

  /** Enable health check route */
  healthCheck?: boolean | HealthCheckConfig;
}

export interface HealthCheckConfig {
  /** Route path for health check */
  path?: string;

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
