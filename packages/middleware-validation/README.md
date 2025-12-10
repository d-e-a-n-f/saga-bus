# @saga-bus/middleware-validation

Validation middleware for saga-bus that validates message payloads before processing.

## Installation

```bash
npm install @saga-bus/middleware-validation
# or
pnpm add @saga-bus/middleware-validation
```

For Zod support:

```bash
npm install zod
```

## Features

- **Schema Validation**: Validate messages against Zod schemas or custom validators
- **Multiple Actions**: Skip, log, throw, or DLQ invalid messages
- **Strict Mode**: Optionally reject messages without registered validators
- **Type Exclusions**: Skip validation for specific message types
- **Custom Validators**: Use function-based validators for complex logic

## Quick Start

```typescript
import { createBus } from "@saga-bus/core";
import { z } from "zod";
import {
  createValidationMiddleware,
  createZodValidator,
} from "@saga-bus/middleware-validation";

const OrderCreatedSchema = z.object({
  type: z.literal("OrderCreated"),
  orderId: z.string().uuid(),
  customerId: z.string(),
  items: z.array(z.object({
    sku: z.string(),
    quantity: z.number().positive(),
  })).min(1),
});

const validationMiddleware = createValidationMiddleware({
  validators: {
    OrderCreated: createZodValidator(OrderCreatedSchema),
  },
  onInvalid: "throw",
});

const bus = createBus({
  transport,
  store,
  sagas: [OrderSaga],
  middleware: [validationMiddleware],
});
```

## API Reference

### createValidationMiddleware(options)

Creates middleware that validates message payloads.

```typescript
interface ValidationMiddlewareOptions {
  /** Map of message type to validator */
  validators: Record<string, MessageValidator>;

  /** Action on invalid: "skip" | "log" | "throw" | "dlq" (default: "throw") */
  onInvalid?: "skip" | "log" | "throw" | "dlq";

  /** Handler for DLQ (required if onInvalid is "dlq") */
  deadLetterHandler?: (envelope: MessageEnvelope, errors: ValidationError[]) => Promise<void>;

  /** Logger for validation errors */
  logger?: { warn(...): void; error(...): void };

  /** Reject messages without validators (default: false) */
  strictMode?: boolean;

  /** Message types to skip validation */
  excludeTypes?: string[];
}
```

### createZodValidator(schema)

Creates a validator from a Zod schema.

```typescript
import { z } from "zod";
import { createZodValidator } from "@saga-bus/middleware-validation";

const validator = createZodValidator(z.object({
  type: z.literal("OrderCreated"),
  orderId: z.string(),
}));
```

### createZodValidators(schemas)

Creates multiple validators from a map of Zod schemas.

```typescript
import { createZodValidators } from "@saga-bus/middleware-validation";

const validators = createZodValidators({
  OrderCreated: OrderCreatedSchema,
  OrderShipped: OrderShippedSchema,
  PaymentReceived: PaymentReceivedSchema,
});
```

### createFunctionValidator(fn)

Creates a validator from a simple validation function.

```typescript
import { createFunctionValidator } from "@saga-bus/middleware-validation";

const validator = createFunctionValidator((message) => {
  if (!message.orderId) return "orderId is required";
  if (message.items.length === 0) return "Order must have items";
  return true;
});
```

### combineValidators(validators)

Combines multiple validators into one.

```typescript
import { combineValidators, createFunctionValidator } from "@saga-bus/middleware-validation";

const validator = combineValidators([
  createFunctionValidator((msg) => !!msg.orderId || "orderId required"),
  createFunctionValidator((msg) => msg.items.length > 0 || "items required"),
]);
```

### MessageValidationError

Error thrown when validation fails and `onInvalid: "throw"`.

```typescript
import { MessageValidationError } from "@saga-bus/middleware-validation";

try {
  await bus.publish(message);
} catch (error) {
  if (error instanceof MessageValidationError) {
    console.log(`Invalid message: ${error.messageId}`);
    console.log(`Errors:`, error.validationErrors);
  }
}
```

## Examples

### Basic Zod Validation

```typescript
import { z } from "zod";
import { createValidationMiddleware, createZodValidator } from "@saga-bus/middleware-validation";

const middleware = createValidationMiddleware({
  validators: {
    OrderCreated: createZodValidator(z.object({
      type: z.literal("OrderCreated"),
      orderId: z.string().uuid(),
      customerId: z.string(),
      items: z.array(z.object({
        sku: z.string(),
        quantity: z.number().int().positive(),
        price: z.number().nonnegative(),
      })).min(1),
      total: z.number().nonnegative(),
    })),
  },
});
```

### Custom Function Validator

```typescript
import { createValidationMiddleware, createFunctionValidator } from "@saga-bus/middleware-validation";

const middleware = createValidationMiddleware({
  validators: {
    PaymentReceived: createFunctionValidator(async (message) => {
      // Async validation - check against external service
      const isValidPaymentId = await paymentService.verify(message.paymentId);
      if (!isValidPaymentId) {
        return "Invalid payment ID";
      }
      return true;
    }),
  },
});
```

### Dead Letter Queue

```typescript
import { createValidationMiddleware } from "@saga-bus/middleware-validation";

const middleware = createValidationMiddleware({
  validators,
  onInvalid: "dlq",
  deadLetterHandler: async (envelope, errors) => {
    await deadLetterQueue.send({
      originalMessage: envelope,
      validationErrors: errors,
      timestamp: new Date(),
    });
  },
  logger: console,
});
```

### Strict Mode

```typescript
// Reject any message without a registered validator
const middleware = createValidationMiddleware({
  validators: {
    OrderCreated: orderCreatedValidator,
    OrderShipped: orderShippedValidator,
  },
  strictMode: true,
  onInvalid: "throw",
});
```

### Excluding Message Types

```typescript
// Don't validate system messages
const middleware = createValidationMiddleware({
  validators,
  excludeTypes: ["Heartbeat", "HealthCheck", "SagaTimeoutExpired"],
});
```

### Logging Invalid Messages

```typescript
import { logger } from "./logger";

const middleware = createValidationMiddleware({
  validators,
  onInvalid: "log",
  logger: {
    warn: (msg, meta) => logger.warn(msg, meta),
    error: (msg, meta) => logger.error(msg, meta),
  },
});
```

### Combining Multiple Validation Strategies

```typescript
import { combineValidators, createZodValidator, createFunctionValidator } from "@saga-bus/middleware-validation";
import { z } from "zod";

// Schema validation + business rule validation
const orderValidator = combineValidators([
  // Schema validation
  createZodValidator(z.object({
    type: z.literal("OrderCreated"),
    orderId: z.string(),
    customerId: z.string(),
    items: z.array(z.object({
      sku: z.string(),
      quantity: z.number().positive(),
    })),
    total: z.number(),
  })),

  // Business rules
  createFunctionValidator(async (msg) => {
    const errors: string[] = [];

    // Check customer exists
    const customer = await customerService.get(msg.customerId);
    if (!customer) {
      errors.push(`Customer ${msg.customerId} not found`);
    }

    // Verify total matches items
    const calculatedTotal = msg.items.reduce(
      (sum, item) => sum + item.quantity * (item.price || 0),
      0
    );
    if (Math.abs(calculatedTotal - msg.total) > 0.01) {
      errors.push("Total doesn't match item prices");
    }

    return errors.length === 0 ? true : errors;
  }),
]);
```

## Custom Validator Implementation

Create custom validators by implementing the `MessageValidator` interface:

```typescript
import type { MessageValidator, ValidationResult } from "@saga-bus/middleware-validation";

const customValidator: MessageValidator = (message) => {
  const errors = [];

  if (!message.orderId) {
    errors.push({ path: "orderId", message: "Required" });
  }

  if (message.items?.length === 0) {
    errors.push({ path: "items", message: "Must have at least one item" });
  }

  return errors.length === 0
    ? { valid: true }
    : { valid: false, errors };
};
```

## ValidationResult Interface

```typescript
interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;      // e.g., "items[0].quantity"
    message: string;   // e.g., "Must be positive"
    value?: unknown;   // The invalid value
  }>;
}
```

## Best Practices

1. **Use Zod for complex schemas** - It provides excellent type inference and error messages
2. **Use function validators for async/business logic** - External service calls, database lookups
3. **Consider strict mode in production** - Catch unvalidated message types early
4. **Use DLQ for debugging** - Store invalid messages for analysis
5. **Exclude system messages** - Don't validate internal messages like timeouts

## License

MIT
