---
sidebar_position: 3
---

# Handlers

Define how your saga responds to messages.

## `.on(messageType)`

Starts a handler definition for a message type:

```typescript
.on('PaymentCaptured')
  .handle(async (msg, state, ctx) => {
    return { ...state, status: 'paid' };
  })
```

## `.when(predicate)`

Adds a state guard (optional):

```typescript
.on('PaymentCaptured')
  .when(state => state.status === 'pending')  // Only handle if pending
  .handle(async (msg, state, ctx) => {
    return { ...state, status: 'paid' };
  })
```

If the predicate returns `false`, the message is ignored.

## `.handle(handler)`

The message handler function:

```typescript
.handle(async (msg, state, ctx) => {
  // msg - The incoming message (typed)
  // state - Current saga state (typed)
  // ctx - Saga context (publish, complete, etc.)

  // Do work...
  await ctx.publish({ type: 'NextStep', ... });

  // Return new state
  return { ...state, status: 'updated' };
})
```

### Handler Signature

```typescript
type SagaHandler<TMessage, TState> = (
  message: TMessage,
  state: TState,
  context: SagaContext
) => Promise<TState>;
```

### Handler Rules

1. **Must return new state** - Always return a state object
2. **Immutable updates** - Create new objects, don't mutate
3. **Async** - Handlers are always async

## Multiple Handlers

Chain multiple handlers for different messages:

```typescript
.on('PaymentCaptured')
  .handle(async (msg, state, ctx) => ({ ...state, status: 'paid' }))

.on('PaymentFailed')
  .handle(async (msg, state, ctx) => ({ ...state, status: 'failed' }))

.on('OrderShipped')
  .when(state => state.status === 'paid')
  .handle(async (msg, state, ctx) => {
    ctx.complete();
    return { ...state, status: 'shipped' };
  })
```

## Built-in Message Types

### `SagaTimeoutExpired`

Automatically published when a timeout expires:

```typescript
.on('SagaTimeoutExpired')
  .when(state => state.status === 'awaiting_payment')
  .handle(async (msg, state, ctx) => {
    ctx.complete();
    return { ...state, status: 'timed_out' };
  })
```
