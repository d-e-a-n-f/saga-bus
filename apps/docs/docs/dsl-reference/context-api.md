---
sidebar_position: 4
---

# Context API

The `SagaContext` provides utilities within handlers.

## Overview

```typescript
.on('SomeMessage')
  .handle(async (msg, state, ctx) => {
    // ctx is the SagaContext
    await ctx.publish({ type: 'NextStep', ... });
    ctx.complete();
    return state;
  })
```

## Methods

### `ctx.publish(message, options?)`

Publish a message to the transport:

```typescript
await ctx.publish({
  type: 'OrderShipped',
  orderId: state.orderId,
  trackingNumber: 'TRACK-123',
});
```

### `ctx.schedule(message, delayMs, options?)`

Schedule a message for future delivery:

```typescript
// Send reminder in 24 hours
await ctx.schedule(
  { type: 'PaymentReminder', orderId: state.orderId },
  24 * 60 * 60 * 1000
);
```

### `ctx.complete()`

Mark the saga as completed:

```typescript
.on('OrderCompleted')
  .handle(async (msg, state, ctx) => {
    ctx.complete();  // Sets isCompleted = true
    return { ...state, status: 'completed' };
  })
```

### `ctx.setTimeout(delayMs)`

Set a timeout for the saga:

```typescript
ctx.setTimeout(30 * 60 * 1000);  // 30 minutes
```

### `ctx.clearTimeout()`

Clear an active timeout:

```typescript
ctx.clearTimeout();
```

### `ctx.getTimeoutRemaining()`

Get remaining timeout duration:

```typescript
const remaining = ctx.getTimeoutRemaining();
// Returns milliseconds or null if no timeout
```

### `ctx.setMetadata(key, value)`

Set custom metadata (useful for tracing):

```typescript
ctx.setMetadata('order.total', state.total);
ctx.setMetadata('customer.tier', 'premium');
```

### `ctx.getMetadata<T>(key)`

Get custom metadata:

```typescript
const tier = ctx.getMetadata<string>('customer.tier');
```

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `ctx.sagaName` | `string` | Name of the saga |
| `ctx.sagaId` | `string` | Unique saga instance ID |
| `ctx.correlationId` | `string` | Business correlation ID |
| `ctx.envelope` | `MessageEnvelope` | Full message envelope |
