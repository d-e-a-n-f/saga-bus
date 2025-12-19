---
sidebar_position: 4
---

# Correlation

Correlation links incoming messages to the correct saga instance.

## Basic Correlation

Define how each message type correlates to a saga:

```typescript
const saga = createSagaMachine<OrderState, OrderMessages>()
  .name('OrderSaga')
  .correlate('OrderSubmitted', msg => msg.orderId, { canStart: true })
  .correlate('PaymentCaptured', msg => msg.orderId)
  .correlate('InventoryReserved', msg => msg.orderId)
  // ...
```

## The `canStart` Option

Messages with `canStart: true` can create new saga instances:

```typescript
// This message can start a new saga
.correlate('OrderSubmitted', msg => msg.orderId, { canStart: true })

// This message cannot start a saga (must find existing)
.correlate('PaymentCaptured', msg => msg.orderId)
```

If a message without `canStart` arrives and no saga exists, it's ignored.

## Wildcard Correlation

Use `'*'` to define a default correlation for all message types:

```typescript
.correlate('OrderSubmitted', msg => msg.orderId, { canStart: true })
.correlate('*', msg => msg.orderId)  // All other messages use orderId
```

This is useful when all messages share the same correlation field.

## Multiple Correlation IDs

A single message type can correlate by different fields:

```typescript
// In a payment saga, correlate by different IDs
.correlate('PaymentRequested', msg => msg.paymentId, { canStart: true })
.correlate('PaymentConfirmed', msg => msg.paymentId)
.correlate('RefundRequested', msg => msg.originalPaymentId)  // Different field!
```

## Correlation Flow

```
Message Received
      │
      ▼
Extract Correlation ID
(using correlate function)
      │
      ▼
Query Store by Correlation ID
      │
      ├── Found ──► Load existing saga
      │
      └── Not Found
            │
            ├── canStart = true ──► Create new saga
            │
            └── canStart = false ──► Ignore message
```

## Best Practices

### Use Business IDs

Correlate by meaningful business identifiers:

```typescript
// ✅ Good - uses business ID
.correlate('OrderSubmitted', msg => msg.orderId)

// ❌ Avoid - uses technical ID
.correlate('OrderSubmitted', msg => msg.messageId)
```

### Consistent Correlation

Ensure all related messages include the correlation field:

```typescript
// All order-related messages should have orderId
interface PaymentCaptured {
  type: 'PaymentCaptured';
  orderId: string;  // ✅ Correlation field
  transactionId: string;
}
```
