import type { Registry, Counter, Histogram } from "prom-client";

/**
 * Options for configuring the metrics middleware.
 */
export interface MetricsMiddlewareOptions {
  /**
   * Prometheus registry to use. Defaults to the global default registry.
   */
  registry?: Registry;

  /**
   * Prefix for metric names. Defaults to "saga_bus".
   */
  prefix?: string;

  /**
   * Custom labels to add to all metrics.
   */
  customLabels?: Record<string, string>;

  /**
   * Histogram buckets for processing duration in milliseconds.
   * Defaults to [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
   */
  durationBuckets?: number[];

  /**
   * Whether to record saga-related labels (saga_name, is_new, is_completed).
   * Defaults to true.
   */
  recordSagaLabels?: boolean;
}

/**
 * Metrics exposed by the middleware.
 */
export interface SagaBusMetrics {
  /**
   * Counter for total messages processed.
   */
  messagesProcessed: Counter;

  /**
   * Counter for total messages failed.
   */
  messagesFailed: Counter;

  /**
   * Histogram for message processing duration.
   */
  processingDuration: Histogram;

  /**
   * Counter for sagas created.
   */
  sagasCreated: Counter;

  /**
   * Counter for sagas completed.
   */
  sagasCompleted: Counter;
}
