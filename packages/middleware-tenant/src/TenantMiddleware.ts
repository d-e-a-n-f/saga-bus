import type {
  SagaMiddleware,
  SagaPipelineContext,
  MessageEnvelope,
} from "@saga-bus/core";
import type { TenantMiddlewareOptions, TenantResolver } from "./types.js";
import { TenantResolutionError, TenantNotAllowedError } from "./types.js";
import { runWithTenant } from "./TenantContext.js";

/**
 * Create multi-tenant middleware for saga-bus.
 *
 * Resolves tenant ID from messages and provides tenant context
 * via AsyncLocalStorage for use within handlers.
 *
 * @example
 * ```typescript
 * const middleware = createTenantMiddleware({
 *   strategy: "header",
 *   headerName: "x-tenant-id",
 *   allowedTenants: ["tenant1", "tenant2"],
 * });
 *
 * const bus = createMessageBus({
 *   middleware: [middleware],
 * });
 * ```
 */
export function createTenantMiddleware(
  options: TenantMiddlewareOptions = {}
): SagaMiddleware {
  const strategy = options.strategy ?? "header";
  const headerName = options.headerName ?? "x-tenant-id";
  const correlationSeparator = options.correlationSeparator ?? ":";
  const required = options.required ?? true;
  const defaultTenantId = options.defaultTenantId;
  const allowedTenants = options.allowedTenants
    ? new Set(options.allowedTenants)
    : undefined;
  const prefixSagaId = options.prefixSagaId ?? true;

  const resolver =
    options.resolver ??
    createResolver(strategy, {
      headerName,
      correlationSeparator,
    });

  return async (ctx: SagaPipelineContext, next: () => Promise<void>) => {
    const { envelope } = ctx;

    // Resolve tenant ID
    let tenantId = resolver(envelope);

    if (!tenantId) {
      if (required) {
        throw new TenantResolutionError(
          `Could not resolve tenant ID from message using strategy "${strategy}"`,
          envelope
        );
      }
      tenantId = defaultTenantId;
    }

    if (!tenantId) {
      // No tenant and not required - proceed without tenant context
      await next();
      return;
    }

    // Validate against allowlist
    if (allowedTenants && !allowedTenants.has(tenantId)) {
      throw new TenantNotAllowedError(tenantId, envelope);
    }

    // Modify saga ID if needed
    let originalSagaId: string | undefined;
    if (prefixSagaId && ctx.sagaId) {
      originalSagaId = ctx.sagaId;
      ctx.sagaId = `${tenantId}:${ctx.sagaId}`;
    }

    // Run handler within tenant context
    await runWithTenant({ tenantId, originalSagaId }, async () => {
      await next();
    });
  };
}

/**
 * Create a publish interceptor that adds tenant ID to outbound messages.
 *
 * @example
 * ```typescript
 * const publisher = createTenantPublisher();
 * const envelope = publisher(originalEnvelope, "tenant1");
 * ```
 */
export function createTenantPublisher(
  options: Pick<TenantMiddlewareOptions, "headerName"> = {}
): (envelope: MessageEnvelope, tenantId: string) => MessageEnvelope {
  const headerName = options.headerName ?? "x-tenant-id";

  return (envelope: MessageEnvelope, tenantId: string): MessageEnvelope => {
    return {
      ...envelope,
      headers: {
        ...envelope.headers,
        [headerName]: tenantId,
      },
    };
  };
}

function createResolver(
  strategy: "header" | "correlation-prefix" | "custom",
  options: {
    headerName: string;
    correlationSeparator: string;
  }
): TenantResolver {
  switch (strategy) {
    case "header":
      return (envelope: MessageEnvelope) => {
        return envelope.headers[options.headerName];
      };

    case "correlation-prefix":
      return (envelope: MessageEnvelope) => {
        const partitionKey = envelope.partitionKey;
        if (!partitionKey) {
          return undefined;
        }
        const separatorIndex = partitionKey.indexOf(options.correlationSeparator);
        if (separatorIndex === -1) {
          return undefined;
        }
        return partitionKey.slice(0, separatorIndex);
      };

    case "custom":
      throw new Error("Custom strategy requires a resolver function");
  }
}
