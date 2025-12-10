import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";

export function initTelemetry(): NodeSDK {
  const resource = new Resource({
    [ATTR_SERVICE_NAME]: "saga-bus-worker",
    [ATTR_SERVICE_VERSION]: "0.0.1",
    "deployment.environment": process.env.NODE_ENV || "development",
  });

  const traceExporter = new OTLPTraceExporter({
    url: `${OTEL_ENDPOINT}/v1/traces`,
  });

  // Note: Metrics are handled by prom-client and scraped by Prometheus
  // We only use OpenTelemetry for distributed tracing to Jaeger
  const sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable noisy instrumentations
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
      }),
    ],
  });

  // Start the SDK
  sdk.start();
  console.log("OpenTelemetry SDK initialized");
  console.log(`Traces will be sent to: ${OTEL_ENDPOINT}/v1/traces`);

  return sdk;
}

export async function shutdownTelemetry(sdk: NodeSDK): Promise<void> {
  try {
    await sdk.shutdown();
    console.log("OpenTelemetry SDK shut down successfully");
  } catch (error) {
    console.error("Error shutting down OpenTelemetry SDK:", error);
  }
}
