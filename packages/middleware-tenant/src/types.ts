import type { MessageEnvelope } from "@saga-bus/core";

/**
 * Tenant middleware configuration options.
 */
export interface TenantMiddlewareOptions {
  /**
   * Strategy for resolving tenant ID from messages.
   * @default "header"
   */
  strategy?: "header" | "correlation-prefix" | "custom";

  /**
   * Custom tenant resolver function.
   * Required when strategy is "custom".
   */
  resolver?: TenantResolver;

  /**
   * Header name for tenant ID when using "header" strategy.
   * @default "x-tenant-id"
   */
  headerName?: string;

  /**
   * Separator for correlation prefix strategy.
   * @default ":"
   */
  correlationSeparator?: string;

  /**
   * Whether to require tenant ID on all messages.
   * @default true
   */
  required?: boolean;

  /**
   * Default tenant ID when not required and not found.
   */
  defaultTenantId?: string;

  /**
   * Allowlist of valid tenant IDs.
   * If provided, messages from unknown tenants are rejected.
   */
  allowedTenants?: string[];

  /**
   * Whether to prefix saga IDs with tenant ID for isolation.
   * @default true
   */
  prefixSagaId?: boolean;
}

/**
 * Function to resolve tenant ID from a message.
 */
export type TenantResolver = (envelope: MessageEnvelope) => string | undefined;

/**
 * Tenant context for the current request.
 */
export interface TenantInfo {
  /**
   * Resolved tenant ID.
   */
  tenantId: string;

  /**
   * Original saga ID before tenant prefix.
   */
  originalSagaId?: string;
}

/**
 * Error thrown when tenant resolution fails.
 */
export class TenantResolutionError extends Error {
  constructor(
    message: string,
    public readonly envelope: MessageEnvelope
  ) {
    super(message);
    this.name = "TenantResolutionError";
  }
}

/**
 * Error thrown when tenant is not in allowlist.
 */
export class TenantNotAllowedError extends Error {
  constructor(
    public readonly tenantId: string,
    public readonly envelope: MessageEnvelope
  ) {
    super(`Tenant "${tenantId}" is not allowed`);
    this.name = "TenantNotAllowedError";
  }
}
