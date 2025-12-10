import type { BaseMessage } from "@saga-bus/core";
import type {
  MessageValidator,
  ValidationResult,
  ValidationError,
} from "../types.js";

/**
 * A simple validation function that returns true/false or an error message.
 */
export type SimpleValidationFn<T> = (
  message: T
) => boolean | string | string[] | Promise<boolean | string | string[]>;

/**
 * Creates a validator from a simple validation function.
 *
 * @example
 * ```typescript
 * import { createFunctionValidator } from "@saga-bus/middleware-validation";
 *
 * const validator = createFunctionValidator((message: OrderCreated) => {
 *   if (!message.orderId) {
 *     return "orderId is required";
 *   }
 *   if (message.items.length === 0) {
 *     return "Order must have at least one item";
 *   }
 *   return true;
 * });
 * ```
 */
export function createFunctionValidator<T extends BaseMessage = BaseMessage>(
  fn: SimpleValidationFn<T>
): MessageValidator<T> {
  return async (message: T): Promise<ValidationResult> => {
    const result = await fn(message);

    if (result === true) {
      return { valid: true };
    }

    const errors: ValidationError[] = [];

    if (result === false) {
      errors.push({ path: "", message: "Validation failed" });
    } else if (typeof result === "string") {
      errors.push({ path: "", message: result });
    } else if (Array.isArray(result)) {
      for (const msg of result) {
        errors.push({ path: "", message: msg });
      }
    }

    return { valid: false, errors };
  };
}

/**
 * Combines multiple validators into one.
 * All validators must pass for the message to be valid.
 *
 * @example
 * ```typescript
 * import { combineValidators, createFunctionValidator } from "@saga-bus/middleware-validation";
 *
 * const validator = combineValidators([
 *   createFunctionValidator((msg) => !!msg.orderId || "orderId required"),
 *   createFunctionValidator((msg) => msg.items.length > 0 || "items required"),
 * ]);
 * ```
 */
export function combineValidators<T extends BaseMessage = BaseMessage>(
  validators: MessageValidator<T>[]
): MessageValidator<T> {
  return async (message: T): Promise<ValidationResult> => {
    const allErrors: ValidationError[] = [];

    for (const validator of validators) {
      const result = await validator(message);
      if (!result.valid && result.errors) {
        allErrors.push(...result.errors);
      }
    }

    if (allErrors.length === 0) {
      return { valid: true };
    }

    return { valid: false, errors: allErrors };
  };
}
