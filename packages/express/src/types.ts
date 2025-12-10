import type { Bus } from "@saga-bus/core";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      bus?: Bus;
      correlationId?: string;
    }
  }
}

export interface SagaBusExpressOptions {
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

  /** Path for health endpoint */
  path?: string;

  /** Additional health checks */
  checks?: Array<{
    name: string;
    check: () => Promise<boolean>;
  }>;
}

export interface GracefulShutdownOptions {
  /** The bus instance to drain */
  bus: Bus;

  /** Timeout for graceful shutdown in ms */
  timeoutMs?: number;

  /** Callback before shutdown starts */
  onShutdownStart?: () => void | Promise<void>;

  /** Callback after shutdown completes */
  onShutdownComplete?: () => void | Promise<void>;
}
