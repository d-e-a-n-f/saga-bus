---
sidebar_position: 2
---

# Builder Methods

Core methods for defining saga structure.

## `.name(sagaName)`

Sets the unique saga name:

```typescript
.name('OrderSaga')
```

- **Required**: Yes
- **Must be unique** across all sagas in the bus

## `.correlate(messageType, extractor, options?)`

Defines how messages correlate to saga instances:

```typescript
// Basic correlation
.correlate('OrderSubmitted', msg => msg.orderId)

// With canStart option
.correlate('OrderSubmitted', msg => msg.orderId, { canStart: true })

// Wildcard (default for all types)
.correlate('*', msg => msg.orderId)
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `messageType` | `string \| '*'` | Message type or wildcard |
| `extractor` | `(msg) => string` | Extracts correlation ID |
| `options.canStart` | `boolean` | Can create new saga instances |

## `.initial<TMessage>(factory)`

Creates initial state when a saga starts:

```typescript
.initial<OrderSubmitted>((msg) => ({
  orderId: msg.orderId,
  customerId: msg.customerId,
  status: 'pending',
  total: msg.total,
}))
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `factory` | `(msg: TMessage) => Omit<TState, 'metadata'>` | Creates initial state |

The `metadata` field is added automatically.

## `.build()`

Finalizes and returns the saga definition:

```typescript
const sagaDefinition = createSagaMachine<...>()
  .name('MySaga')
  .correlate(...)
  .initial(...)
  .on(...).handle(...)
  .build();  // Returns SagaDefinition
```

## Complete Example

```typescript
const orderSaga = createSagaMachine<OrderState, OrderMessages>()
  .name('OrderSaga')
  .correlate('OrderSubmitted', msg => msg.orderId, { canStart: true })
  .correlate('*', msg => msg.orderId)
  .initial<OrderSubmitted>((msg) => ({
    orderId: msg.orderId,
    status: 'pending',
    total: msg.total,
  }))
  .on('PaymentCaptured')
    .handle(async (msg, state, ctx) => ({ ...state, status: 'paid' }))
  .build();
```
