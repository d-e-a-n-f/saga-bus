import {
  trace,
  context,
  SpanKind,
  SpanStatusCode,
  propagation,
  type Context,
  type Attributes,
} from "@opentelemetry/api";
import type {
  SagaMiddleware,
  SagaPipelineContext,
  MessageEnvelope,
} from "@saga-bus/core";
import type { TracingMiddlewareOptions, TraceContextHeaders } from "./types.js";

const TRACER_NAME = "@saga-bus/middleware-tracing";

/**
 * OpenTelemetry tracing middleware for saga-bus.
 *
 * Creates spans for message handling with proper context propagation
 * for distributed tracing across services.
 *
 * @example
 * ```typescript
 * import { trace } from "@opentelemetry/api";
 * import { createTracingMiddleware } from "@saga-bus/middleware-tracing";
 *
 * const middleware = createTracingMiddleware({
 *   tracer: trace.getTracer("my-service"),
 * });
 *
 * const bus = createMessageBus({
 *   middleware: [middleware],
 * });
 * ```
 */
export function createTracingMiddleware(
  options: TracingMiddlewareOptions = {}
): SagaMiddleware {
  const tracer =
    options.tracer ?? trace.getTracer(options.tracerName ?? TRACER_NAME);
  const recordPayload = options.recordPayload ?? false;
  const maxPayloadSize = options.maxPayloadSize ?? 1024;
  const attributeExtractor = options.attributeExtractor;

  return async (ctx: SagaPipelineContext, next: () => Promise<void>) => {
    const { envelope } = ctx;

    // Extract parent context from message headers
    const parentContext = extractContext(envelope);

    // Start span with parent context
    const spanName = `saga-bus.handle ${envelope.type}`;
    const span = tracer.startSpan(
      spanName,
      {
        kind: SpanKind.CONSUMER,
        attributes: buildAttributes(envelope, recordPayload, maxPayloadSize),
      },
      parentContext
    );

    // Add custom attributes
    if (attributeExtractor) {
      try {
        const customAttrs = attributeExtractor(envelope);
        span.setAttributes(customAttrs);
      } catch {
        // Ignore extractor errors
      }
    }

    // Add saga attributes
    span.setAttribute("saga.name", ctx.sagaName);
    if (ctx.sagaId) {
      span.setAttribute("saga.id", ctx.sagaId);
    }
    span.setAttribute("saga.correlation_id", ctx.correlationId);

    try {
      // Run next middleware within span context
      await context.with(trace.setSpan(context.active(), span), async () => {
        await next();
      });

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  };
}

/**
 * Create a publish interceptor that adds tracing to outbound messages.
 *
 * @example
 * ```typescript
 * const tracer = createPublishTracer({
 *   tracer: trace.getTracer("my-service"),
 * });
 *
 * // Before publishing, wrap the envelope
 * const tracedEnvelope = tracer(envelope);
 * await transport.publish(tracedEnvelope.payload, options);
 * ```
 */
export function createPublishTracer(
  options: TracingMiddlewareOptions = {}
): (envelope: MessageEnvelope) => MessageEnvelope {
  const tracer =
    options.tracer ?? trace.getTracer(options.tracerName ?? TRACER_NAME);

  return (envelope: MessageEnvelope): MessageEnvelope => {
    const span = tracer.startSpan(`saga-bus.publish ${envelope.type}`, {
      kind: SpanKind.PRODUCER,
      attributes: {
        "messaging.system": "saga-bus",
        "messaging.operation": "publish",
        "messaging.message.id": envelope.id,
        "messaging.message.type": envelope.type,
      },
    });

    // Inject trace context into message headers
    const traceHeaders: TraceContextHeaders = {};
    propagation.inject(trace.setSpan(context.active(), span), traceHeaders);

    span.end();

    // Return envelope with trace headers merged into existing headers
    return {
      ...envelope,
      headers: {
        ...envelope.headers,
        ...(traceHeaders.traceparent && { traceparent: traceHeaders.traceparent }),
        ...(traceHeaders.tracestate && { tracestate: traceHeaders.tracestate }),
      },
    };
  };
}

/**
 * Extract trace context from message headers.
 */
function extractContext(envelope: MessageEnvelope): Context {
  const headers = envelope.headers;

  if (!headers.traceparent) {
    return context.active();
  }

  return propagation.extract(context.active(), headers);
}

/**
 * Build standard span attributes from message envelope.
 */
function buildAttributes(
  envelope: MessageEnvelope,
  recordPayload: boolean,
  maxPayloadSize: number
): Attributes {
  const attrs: Attributes = {
    "messaging.system": "saga-bus",
    "messaging.operation": "process",
    "messaging.message.id": envelope.id,
    "messaging.message.type": envelope.type,
  };

  if (envelope.partitionKey) {
    attrs["messaging.message.partition_key"] = envelope.partitionKey;
  }

  if (recordPayload && envelope.payload !== undefined) {
    const payloadStr = JSON.stringify(envelope.payload);
    if (payloadStr.length <= maxPayloadSize) {
      attrs["messaging.message.payload"] = payloadStr;
    } else {
      attrs["messaging.message.payload"] =
        payloadStr.slice(0, maxPayloadSize) + "...";
      attrs["messaging.message.payload_truncated"] = true;
    }
  }

  return attrs;
}
