import { randomUUID } from "node:crypto";

/**
 * Generate a unique saga ID.
 */
export function generateSagaId(): string {
  return randomUUID();
}

/**
 * Generate a unique message ID.
 */
export function generateMessageId(): string {
  return randomUUID();
}

/**
 * Create a new Date for timestamps.
 */
export function now(): Date {
  return new Date();
}
