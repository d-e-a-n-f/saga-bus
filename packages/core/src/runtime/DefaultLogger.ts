import type { Logger } from "../types/index.js";

/**
 * Default console-based logger implementation.
 */
export class DefaultLogger implements Logger {
  private readonly prefix: string;

  constructor(prefix = "[saga-bus]") {
    this.prefix = prefix;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.debug(`${this.prefix} ${message}`, meta);
    } else {
      console.debug(`${this.prefix} ${message}`);
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.info(`${this.prefix} ${message}`, meta);
    } else {
      console.info(`${this.prefix} ${message}`);
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.warn(`${this.prefix} ${message}`, meta);
    } else {
      console.warn(`${this.prefix} ${message}`);
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.error(`${this.prefix} ${message}`, meta);
    } else {
      console.error(`${this.prefix} ${message}`);
    }
  }
}
