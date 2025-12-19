---
sidebar_position: 6
---

# Timeouts

Handle cases where expected events never arrive.

## Setting Timeouts

Use `ctx.setTimeout()` to set a timeout:

```typescript
.on('OrderSubmitted')
  .handle(async (msg, state, ctx) => {
    // Set 30 minute timeout for payment
    ctx.setTimeout(30 * 60 * 1000);

    await ctx.publish({ type: 'RequestPayment', orderId: state.orderId });
    return { ...state, status: 'awaiting_payment' };
  })
```

## Handling Timeout Expiry

When a timeout expires, `SagaTimeoutExpired` is published:

```typescript
.on('SagaTimeoutExpired')
  .when(state => state.status === 'awaiting_payment')
  .handle(async (msg, state, ctx) => {
    // Payment didn't arrive in time - cancel order
    await ctx.publish({
      type: 'OrderCancelled',
      orderId: state.orderId,
      reason: 'Payment timeout',
    });

    return { ...state, status: 'cancelled' };
  })
```

## Clearing Timeouts

Clear a timeout when the expected event arrives:

```typescript
.on('PaymentCaptured')
  .handle(async (msg, state, ctx) => {
    ctx.clearTimeout();  // Cancel the timeout
    return { ...state, status: 'paid' };
  })
```

## Checking Timeout Status

```typescript
.on('SomeMessage')
  .handle(async (msg, state, ctx) => {
    const remaining = ctx.getTimeoutRemaining();
    if (remaining !== null) {
      console.log(`Timeout expires in ${remaining}ms`);
    }
    return state;
  })
```

## Timeout Metadata

Timeout info is stored in saga metadata:

```typescript
interface SagaStateMetadata {
  timeoutMs?: number | null;        // Timeout duration
  timeoutExpiresAt?: Date | null;   // When it expires
}
```

## Best Practices

### Set Timeouts Early

Set timeouts when entering a waiting state:

```typescript
.on('OrderSubmitted')
  .handle(async (msg, state, ctx) => {
    ctx.setTimeout(30 * 60 * 1000);  // ✅ Set timeout immediately
    // ...
  })
```

### Clear on Success

Always clear timeouts when the expected event arrives:

```typescript
.on('PaymentCaptured')
  .handle(async (msg, state, ctx) => {
    ctx.clearTimeout();  // ✅ Clear timeout
    // ...
  })
```

### Use State Guards

Combine with state guards for safety:

```typescript
.on('SagaTimeoutExpired')
  .when(state => state.status === 'awaiting_payment')  // ✅ Only handle if still waiting
  .handle(...)
```
