import type { Tracer, Attributes } from "@opentelemetry/api";
import type { MessageEnvelope } from "@saga-bus/core";

/**
 * Tracing middleware configuration options.
 */
export interface TracingMiddlewareOptions {
  /**
   * OpenTelemetry tracer instance.
   * If not provided, uses the global tracer.
   */
  tracer?: Tracer;

  /**
   * Tracer name when creating from global provider.
   * @default "@saga-bus/middleware-tracing"
   */
  tracerName?: string;

  /**
   * Whether to record message payloads as span attributes.
   * May expose sensitive data - use with caution.
   * @default false
   */
  recordPayload?: boolean;

  /**
   * Maximum payload size to record (bytes).
   * @default 1024
   */
  maxPayloadSize?: number;

  /**
   * Custom attribute extractor.
   * Called for each message to add custom attributes.
   */
  attributeExtractor?: (envelope: MessageEnvelope) => Attributes;
}

/**
 * Trace context propagation headers.
 */
export interface TraceContextHeaders {
  traceparent?: string;
  tracestate?: string;
}
