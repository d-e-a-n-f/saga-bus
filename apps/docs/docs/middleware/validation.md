---
sidebar_position: 5
title: Validation
---

# Validation Middleware

Schema validation for messages using Zod, Yup, or custom validators.

## Installation

```bash npm2yarn
npm install @saga-bus/middleware-validation zod
```

## Basic Usage

```typescript
import { createValidationMiddleware } from '@saga-bus/middleware-validation';
import { z } from 'zod';

const schemas = {
  OrderSubmitted: z.object({
    orderId: z.string().uuid(),
    customerId: z.string(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().positive(),
      price: z.number().positive(),
    })),
    total: z.number().positive(),
  }),
};

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
  middleware: [
    createValidationMiddleware({ schemas }),
  ],
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `schemas` | `Record<string, Schema>` | `{}` | Message type to schema map |
| `validator` | `Validator` | Zod | Validation library adapter |
| `onError` | `function` | throw | Error handling strategy |
| `strict` | `boolean` | `false` | Reject unknown message types |
| `stripUnknown` | `boolean` | `false` | Remove unknown fields |

## Full Configuration Example

```typescript
import { createValidationMiddleware } from '@saga-bus/middleware-validation';
import { z } from 'zod';

const schemas = {
  OrderSubmitted: z.object({
    orderId: z.string().uuid(),
    customerId: z.string(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
      price: z.number().positive(),
    })),
    total: z.number().positive(),
    metadata: z.record(z.unknown()).optional(),
  }),

  PaymentCaptured: z.object({
    orderId: z.string().uuid(),
    paymentId: z.string(),
    amount: z.number().positive(),
    currency: z.enum(['USD', 'EUR', 'GBP']),
  }),

  OrderShipped: z.object({
    orderId: z.string().uuid(),
    trackingNumber: z.string(),
    carrier: z.string(),
    estimatedDelivery: z.string().datetime(),
  }),
};

const validationMiddleware = createValidationMiddleware({
  schemas,
  strict: true,
  stripUnknown: true,
  onError: (error, context) => {
    console.error('Validation failed:', error.issues);
    throw new ValidationError(error.message);
  },
});
```

## Supported Validators

### Zod (Default)

```typescript
import { z } from 'zod';

const schemas = {
  OrderSubmitted: z.object({
    orderId: z.string().uuid(),
    amount: z.number().positive(),
  }),
};

createValidationMiddleware({ schemas });
```

### Yup

```typescript
import * as yup from 'yup';
import { createYupValidator } from '@saga-bus/middleware-validation';

const schemas = {
  OrderSubmitted: yup.object({
    orderId: yup.string().uuid().required(),
    amount: yup.number().positive().required(),
  }),
};

createValidationMiddleware({
  schemas,
  validator: createYupValidator(),
});
```

### Joi

```typescript
import Joi from 'joi';
import { createJoiValidator } from '@saga-bus/middleware-validation';

const schemas = {
  OrderSubmitted: Joi.object({
    orderId: Joi.string().uuid().required(),
    amount: Joi.number().positive().required(),
  }),
};

createValidationMiddleware({
  schemas,
  validator: createJoiValidator(),
});
```

### Custom Validator

```typescript
import { Validator } from '@saga-bus/middleware-validation';

const customValidator: Validator = {
  validate: (schema, data) => {
    // Your validation logic
    if (!isValid(data)) {
      return { success: false, errors: ['Invalid data'] };
    }
    return { success: true, data };
  },
};

createValidationMiddleware({
  schemas,
  validator: customValidator,
});
```

## Error Handling

### Throw (Default)

```typescript
createValidationMiddleware({
  schemas,
  onError: (error, context) => {
    throw new ValidationError(error.message);
  },
});
```

### Log and Skip

```typescript
createValidationMiddleware({
  schemas,
  onError: (error, context) => {
    logger.warn('Validation failed, skipping message', {
      messageType: context.messageType,
      errors: error.issues,
    });
    return 'skip'; // Skip processing
  },
});
```

### Dead Letter

```typescript
createValidationMiddleware({
  schemas,
  onError: async (error, context) => {
    await deadLetterQueue.send({
      message: context.message,
      reason: 'validation_failed',
      errors: error.issues,
    });
    return 'skip';
  },
});
```

## Type Inference

Get TypeScript types from your schemas:

```typescript
import { z } from 'zod';

const OrderSubmittedSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().positive(),
});

// Infer the type
type OrderSubmitted = z.infer<typeof OrderSubmittedSchema>;
// { orderId: string; amount: number }

// Use in saga
const orderSaga = defineSaga<OrderState>({
  name: 'OrderSaga',
})
  .handle<OrderSubmitted>('OrderSubmitted', async (context) => {
    // context.message is typed!
    const { orderId, amount } = context.message;
  });
```

## Strict Mode

Reject messages without schemas:

```typescript
createValidationMiddleware({
  schemas,
  strict: true, // Reject unknown message types
});

// Unknown message type will throw:
// "No schema defined for message type: UnknownEvent"
```

## Strip Unknown Fields

Remove fields not in schema:

```typescript
createValidationMiddleware({
  schemas,
  stripUnknown: true,
});

// Input
{
  orderId: '123',
  amount: 99.99,
  maliciousField: 'hacked'
}

// After validation (stripped)
{
  orderId: '123',
  amount: 99.99
}
```

## Best Practices

### Define Schemas Separately

```typescript
// schemas/order.ts
export const OrderSubmittedSchema = z.object({
  orderId: z.string().uuid(),
  // ...
});

// schemas/index.ts
export const schemas = {
  OrderSubmitted: OrderSubmittedSchema,
  PaymentCaptured: PaymentCapturedSchema,
};
```

### Use Strict Mode in Production

```typescript
createValidationMiddleware({
  schemas,
  strict: process.env.NODE_ENV === 'production',
});
```

### Validate Required Fields

```typescript
// Always validate IDs and amounts
z.object({
  orderId: z.string().uuid(),
  amount: z.number().positive(),
});
```

## See Also

- [Middleware Overview](/docs/middleware/overview)
- [Error Handling](/docs/core-concepts/error-handling)
- [Custom Middleware](/docs/middleware/custom-middleware)
