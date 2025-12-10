import { AsyncLocalStorage } from "node:async_hooks";
import type { TenantInfo } from "./types.js";

const tenantStorage = new AsyncLocalStorage<TenantInfo>();

/**
 * Run a function within a tenant context.
 */
export function runWithTenant<T>(
  tenantInfo: TenantInfo,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return tenantStorage.run(tenantInfo, fn);
}

/**
 * Get the current tenant ID.
 * Returns undefined if not in a tenant context.
 */
export function getTenantId(): string | undefined {
  return tenantStorage.getStore()?.tenantId;
}

/**
 * Get the full tenant info for the current context.
 */
export function getTenantInfo(): TenantInfo | undefined {
  return tenantStorage.getStore();
}

/**
 * Get the current tenant ID or throw if not available.
 */
export function requireTenantId(): string {
  const tenantId = getTenantId();
  if (!tenantId) {
    throw new Error("No tenant context available");
  }
  return tenantId;
}
