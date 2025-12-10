/**
 * Simple semaphore for controlling concurrency.
 */
export class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  /**
   * Acquire a permit, waiting if none are available.
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  /**
   * Release a permit, waking a waiting acquirer if any.
   */
  release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }

  /**
   * Execute a function with a permit.
   */
  async withPermit<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Get the number of available permits.
   */
  get available(): number {
    return this.permits;
  }

  /**
   * Get the number of waiting acquirers.
   */
  get waitingCount(): number {
    return this.waiting.length;
  }
}
