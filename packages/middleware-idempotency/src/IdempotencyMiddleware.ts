import type { SagaMiddleware, SagaPipelineContext } from "@saga-bus/core";
import type { IdempotencyMiddlewareOptions, MessageIdExtractor } from "./types.js";
import { DuplicateMessageError } from "./types.js";

/**
 * Default message ID extractor - uses the envelope ID.
 */
const defaultGetMessageId: MessageIdExtractor = (envelope) => envelope.id;

/**
 * Creates idempotency middleware that prevents duplicate message processing.
 *
 * @example
 * ```typescript
 * import { createIdempotencyMiddleware, InMemoryIdempotencyStore } from "@saga-bus/middleware-idempotency";
 *
 * const idempotencyMiddleware = createIdempotencyMiddleware({
 *   store: new InMemoryIdempotencyStore(),
 *   windowMs: 60000, // 1 minute deduplication window
 * });
 *
 * const bus = createBus({
 *   transport,
 *   store,
 *   sagas: [MySaga],
 *   middleware: [idempotencyMiddleware],
 * });
 * ```
 */
export function createIdempotencyMiddleware(
  options: IdempotencyMiddlewareOptions
): SagaMiddleware {
  const {
    store,
    windowMs = 60000,
    getMessageId = defaultGetMessageId,
    onDuplicate = "skip",
    logger,
    excludeTypes = [],
    markTiming = "after",
  } = options;

  const excludeSet = new Set(excludeTypes);

  return async (ctx: SagaPipelineContext, next: () => Promise<void>) => {
    const { envelope } = ctx;

    // Check if this message type should be excluded from idempotency checks
    if (excludeSet.has(envelope.type)) {
      await next();
      return;
    }

    // Extract message ID
    const messageId = getMessageId(envelope);

    // Check if message was already processed
    const isDuplicate = await store.has(messageId);

    if (isDuplicate) {
      switch (onDuplicate) {
        case "throw":
          throw new DuplicateMessageError(messageId, envelope.type);

        case "log":
          logger?.warn("Duplicate message detected, skipping", {
            messageId,
            messageType: envelope.type,
            correlationId: ctx.correlationId,
            sagaName: ctx.sagaName,
          });
          // Fall through to skip

        case "skip":
        default:
          // Skip processing - don't call next()
          return;
      }
    }

    // Mark as processed before handler (at-most-once)
    if (markTiming === "before") {
      await store.set(messageId, windowMs);
    }

    // Process the message
    await next();

    // Mark as processed after handler (at-least-once, default)
    if (markTiming === "after") {
      await store.set(messageId, windowMs);
    }
  };
}
