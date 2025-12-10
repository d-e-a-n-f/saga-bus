import type { BaseMessage } from "@saga-bus/core";
import type { SyncMessageValidator, ValidationResult, ValidationError, AnyMessageValidator } from "../types.js";

// Type for Zod schema - we don't import zod directly to keep it optional
interface ZodSchema {
  safeParse(data: unknown): {
    success: boolean;
    data?: unknown;
    error?: {
      issues: Array<{
        path: (string | number)[];
        message: string;
      }>;
    };
  };
}

/**
 * Creates a validator from a Zod schema.
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 * import { createZodValidator } from "@saga-bus/middleware-validation";
 *
 * const OrderCreatedSchema = z.object({
 *   type: z.literal("OrderCreated"),
 *   orderId: z.string().uuid(),
 *   customerId: z.string(),
 *   items: z.array(z.object({
 *     sku: z.string(),
 *     quantity: z.number().positive(),
 *   })),
 *   total: z.number().nonnegative(),
 * });
 *
 * const validator = createZodValidator(OrderCreatedSchema);
 * ```
 */
export function createZodValidator<T extends BaseMessage = BaseMessage>(schema: ZodSchema): SyncMessageValidator<T> {
  return (message: T): ValidationResult => {
    const result = schema.safeParse(message);

    if (result.success) {
      return { valid: true };
    }

    const errors: ValidationError[] = result.error!.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));

    return { valid: false, errors };
  };
}

/**
 * Creates multiple validators from a map of Zod schemas.
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 * import { createZodValidators } from "@saga-bus/middleware-validation";
 *
 * const validators = createZodValidators({
 *   OrderCreated: z.object({
 *     type: z.literal("OrderCreated"),
 *     orderId: z.string(),
 *   }),
 *   OrderShipped: z.object({
 *     type: z.literal("OrderShipped"),
 *     orderId: z.string(),
 *     trackingNumber: z.string(),
 *   }),
 * });
 * ```
 */
export function createZodValidators(
  schemas: Record<string, ZodSchema>
): Record<string, AnyMessageValidator> {
  const validators: Record<string, AnyMessageValidator> = {};

  for (const [type, schema] of Object.entries(schemas)) {
    validators[type] = createZodValidator(schema);
  }

  return validators;
}
