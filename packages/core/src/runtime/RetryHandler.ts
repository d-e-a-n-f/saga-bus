import type {
  WorkerRetryPolicy,
  MessageEnvelope,
  Transport,
  Logger,
} from "../types/index.js";

/**
 * Header names for retry tracking.
 */
export const RETRY_HEADERS = {
  ATTEMPT: "x-saga-attempt",
  FIRST_SEEN: "x-saga-first-seen",
  ORIGINAL_ENDPOINT: "x-saga-original-endpoint",
  ERROR_MESSAGE: "x-saga-error-message",
  ERROR_TYPE: "x-saga-error-type",
} as const;

/**
 * Default retry policy.
 */
export const DEFAULT_RETRY_POLICY: WorkerRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoff: "exponential",
};

/**
 * Default DLQ naming function.
 */
export function defaultDlqNaming(endpoint: string): string {
  return `${endpoint}.dlq`;
}

/**
 * Calculate delay based on retry policy and attempt number.
 */
export function calculateDelay(
  policy: WorkerRetryPolicy,
  attempt: number
): number {
  let delay: number;

  if (policy.backoff === "linear") {
    delay = policy.baseDelayMs * attempt;
  } else {
    // Exponential backoff: base * 2^(attempt-1)
    delay = policy.baseDelayMs * Math.pow(2, attempt - 1);
  }

  // Cap at max delay
  return Math.min(delay, policy.maxDelayMs);
}

/**
 * Extract attempt count from message headers.
 */
export function getAttemptCount(envelope: MessageEnvelope): number {
  const attempt = envelope.headers[RETRY_HEADERS.ATTEMPT];
  if (attempt) {
    const parsed = parseInt(attempt, 10);
    return isNaN(parsed) ? 1 : parsed;
  }
  return 1;
}

/**
 * Get the first-seen timestamp from headers.
 */
export function getFirstSeen(envelope: MessageEnvelope): Date {
  const firstSeen = envelope.headers[RETRY_HEADERS.FIRST_SEEN];
  if (firstSeen) {
    return new Date(firstSeen);
  }
  return envelope.timestamp;
}

export interface RetryHandlerOptions {
  transport: Transport;
  logger: Logger;
  defaultPolicy: WorkerRetryPolicy;
  dlqNaming: (endpoint: string) => string;
}

/**
 * Handles retry logic and DLQ routing.
 */
export class RetryHandler {
  private readonly transport: Transport;
  private readonly logger: Logger;
  private readonly defaultPolicy: WorkerRetryPolicy;
  private readonly dlqNaming: (endpoint: string) => string;

  constructor(options: RetryHandlerOptions) {
    this.transport = options.transport;
    this.logger = options.logger;
    this.defaultPolicy = options.defaultPolicy;
    this.dlqNaming = options.dlqNaming;
  }

  /**
   * Handle a failed message - either retry or send to DLQ.
   *
   * @returns true if message was retried, false if sent to DLQ
   */
  async handleFailure(
    envelope: MessageEnvelope,
    endpoint: string,
    error: unknown,
    policy: WorkerRetryPolicy = this.defaultPolicy
  ): Promise<boolean> {
    const attempt = getAttemptCount(envelope);
    const firstSeen = getFirstSeen(envelope);

    if (attempt < policy.maxAttempts) {
      // Retry
      const delay = calculateDelay(policy, attempt);
      const nextAttempt = attempt + 1;

      this.logger.info("Retrying message", {
        messageId: envelope.id,
        messageType: envelope.type,
        endpoint,
        attempt: nextAttempt,
        maxAttempts: policy.maxAttempts,
        delayMs: delay,
      });

      // Re-publish with updated headers
      const retryHeaders: Record<string, string> = {
        ...envelope.headers,
        [RETRY_HEADERS.ATTEMPT]: String(nextAttempt),
        [RETRY_HEADERS.FIRST_SEEN]: firstSeen.toISOString(),
        [RETRY_HEADERS.ORIGINAL_ENDPOINT]: envelope.headers[RETRY_HEADERS.ORIGINAL_ENDPOINT] ?? endpoint,
      };

      await this.transport.publish(envelope.payload, {
        endpoint,
        headers: retryHeaders,
        delayMs: delay,
        key: envelope.partitionKey,
      });

      return true;
    }

    // Max attempts exceeded - send to DLQ
    await this.sendToDlq(envelope, endpoint, error);
    return false;
  }

  /**
   * Send a message to the dead-letter queue.
   */
  async sendToDlq(
    envelope: MessageEnvelope,
    originalEndpoint: string,
    error: unknown
  ): Promise<void> {
    const dlqEndpoint = this.dlqNaming(originalEndpoint);
    const attempt = getAttemptCount(envelope);
    const firstSeen = getFirstSeen(envelope);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = error instanceof Error ? error.name : "UnknownError";

    this.logger.warn("Sending message to DLQ", {
      messageId: envelope.id,
      messageType: envelope.type,
      originalEndpoint,
      dlqEndpoint,
      attempts: attempt,
      firstSeen: firstSeen.toISOString(),
      error: errorMessage,
    });

    const dlqHeaders: Record<string, string> = {
      ...envelope.headers,
      [RETRY_HEADERS.ATTEMPT]: String(attempt),
      [RETRY_HEADERS.FIRST_SEEN]: firstSeen.toISOString(),
      [RETRY_HEADERS.ORIGINAL_ENDPOINT]: envelope.headers[RETRY_HEADERS.ORIGINAL_ENDPOINT] ?? originalEndpoint,
      [RETRY_HEADERS.ERROR_MESSAGE]: errorMessage,
      [RETRY_HEADERS.ERROR_TYPE]: errorType,
    };

    await this.transport.publish(envelope.payload, {
      endpoint: dlqEndpoint,
      headers: dlqHeaders,
      key: envelope.partitionKey,
    });
  }
}
