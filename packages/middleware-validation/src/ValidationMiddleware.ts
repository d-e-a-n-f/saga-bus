import type { SagaMiddleware, SagaPipelineContext } from "@saga-bus/core";
import type { ValidationMiddlewareOptions, ValidationError } from "./types.js";
import { MessageValidationError } from "./types.js";

/**
 * Creates validation middleware that validates message payloads before processing.
 *
 * @example
 * ```typescript
 * import { createValidationMiddleware, createZodValidator } from "@saga-bus/middleware-validation";
 * import { z } from "zod";
 *
 * const validationMiddleware = createValidationMiddleware({
 *   validators: {
 *     OrderCreated: createZodValidator(z.object({
 *       type: z.literal("OrderCreated"),
 *       orderId: z.string(),
 *       customerId: z.string(),
 *     })),
 *   },
 *   onInvalid: "throw",
 * });
 *
 * const bus = createBus({
 *   transport,
 *   store,
 *   sagas: [MySaga],
 *   middleware: [validationMiddleware],
 * });
 * ```
 */
export function createValidationMiddleware(
  options: ValidationMiddlewareOptions
): SagaMiddleware {
  const {
    validators,
    onInvalid = "throw",
    deadLetterHandler,
    logger,
    strictMode = false,
    excludeTypes = [],
  } = options;

  // Validate options
  if (onInvalid === "dlq" && !deadLetterHandler) {
    throw new Error(
      "deadLetterHandler is required when onInvalid is set to 'dlq'"
    );
  }

  const excludeSet = new Set(excludeTypes);

  return async (ctx: SagaPipelineContext, next: () => Promise<void>) => {
    const { envelope } = ctx;
    const messageType = envelope.type;

    // Skip excluded types
    if (excludeSet.has(messageType)) {
      await next();
      return;
    }

    // Get validator for this message type
    const validator = validators[messageType];

    // Handle missing validator
    if (!validator) {
      if (strictMode) {
        const errors: ValidationError[] = [
          {
            path: "type",
            message: `No validator registered for message type: ${messageType}`,
          },
        ];
        await handleInvalidMessage(
          ctx,
          errors,
          onInvalid,
          deadLetterHandler,
          logger
        );
        return;
      }
      // Not strict mode - pass through
      await next();
      return;
    }

    // Validate the message payload
    const result = await validator(envelope.payload);

    if (result.valid) {
      await next();
      return;
    }

    // Handle invalid message
    await handleInvalidMessage(
      ctx,
      result.errors || [],
      onInvalid,
      deadLetterHandler,
      logger
    );
  };
}

async function handleInvalidMessage(
  ctx: SagaPipelineContext,
  errors: ValidationError[],
  onInvalid: string,
  deadLetterHandler: ((envelope: typeof ctx.envelope, errors: ValidationError[]) => Promise<void>) | undefined,
  logger: { warn(message: string, meta?: Record<string, unknown>): void; error(message: string, meta?: Record<string, unknown>): void } | undefined
): Promise<void> {
  const { envelope } = ctx;

  switch (onInvalid) {
    case "throw":
      throw new MessageValidationError(envelope.id, envelope.type, errors);

    case "dlq":
      logger?.error("Invalid message, sending to DLQ", {
        messageId: envelope.id,
        messageType: envelope.type,
        correlationId: ctx.correlationId,
        sagaName: ctx.sagaName,
        errors,
      });
      await deadLetterHandler!(envelope, errors);
      break;

    case "log":
      logger?.warn("Invalid message detected, skipping", {
        messageId: envelope.id,
        messageType: envelope.type,
        correlationId: ctx.correlationId,
        sagaName: ctx.sagaName,
        errors,
      });
      // Fall through to skip

    case "skip":
    default:
      // Don't call next() - silently skip processing
      break;
  }
}
