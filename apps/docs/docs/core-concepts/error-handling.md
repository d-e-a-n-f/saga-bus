---
sidebar_position: 7
---

# Error Handling

How Saga Bus handles different types of errors.

## Error Types

### TransientError

Temporary failures that should be retried:

```typescript
import { TransientError } from '@saga-bus/core';

.on('ProcessPayment')
  .handle(async (msg, state, ctx) => {
    try {
      await paymentService.capture(msg.paymentId);
    } catch (error) {
      // Network error - retry
      throw new TransientError('Payment service unavailable');
    }
    return state;
  })
```

### ValidationError

Invalid messages that should not be retried:

```typescript
import { ValidationError } from '@saga-bus/core';

.on('OrderSubmitted')
  .handle(async (msg, state, ctx) => {
    if (msg.total <= 0) {
      throw new ValidationError('Order total must be positive');
    }
    return state;
  })
```

### ConcurrencyError

Optimistic concurrency violations (auto-retried):

```typescript
import { ConcurrencyError } from '@saga-bus/core';

// Thrown by stores when version mismatch
// Saga Bus automatically retries
```

## Retry Policy

Configure retry behavior:

```typescript
const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
  worker: {
    retry: {
      maxRetries: 5,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
    },
  },
});
```

## Error Handler

Custom error handling:

```typescript
import { createErrorHandler } from '@saga-bus/core';

const errorHandler = createErrorHandler({
  onTransientError: (error, envelope) => {
    console.log('Transient error, will retry:', error.message);
  },
  onPermanentError: (error, envelope) => {
    console.error('Permanent error:', error);
    // Send to DLQ, alert ops, etc.
  },
});

const bus = createBus({
  // ...
  errorHandler,
});
```

## Compensation

Handle failures by undoing previous steps:

```typescript
.on('InventoryReservationFailed')
  .handle(async (msg, state, ctx) => {
    // Compensation: refund the payment we captured
    await ctx.publish({
      type: 'RefundPayment',
      orderId: state.orderId,
      transactionId: state.transactionId,
    });

    // Cancel the order
    await ctx.publish({
      type: 'OrderCancelled',
      orderId: state.orderId,
      reason: 'Inventory unavailable',
    });

    return { ...state, status: 'cancelled' };
  })
```

## Best Practices

### Classify Errors

Wrap external errors appropriately:

```typescript
try {
  await externalService.call();
} catch (error) {
  if (isNetworkError(error)) {
    throw new TransientError('Network error');
  }
  throw error;  // Permanent error
}
```

### Idempotent Handlers

Make handlers idempotent for safe retries:

```typescript
.on('CreateShipment')
  .handle(async (msg, state, ctx) => {
    // Check if already done
    if (state.trackingNumber) {
      return state;  // Already created, skip
    }

    const tracking = await shippingService.create(state.orderId);
    return { ...state, trackingNumber: tracking };
  })
```
