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

export const correlationNodes = [
  { id: 'crecv', type: 'stateNode', position: { x: 200, y: 0 }, data: { label: 'Message Received', status: 'initial' } },
  { id: 'cextract', type: 'stateNode', position: { x: 200, y: 80 }, data: { label: 'Extract Correlation ID', description: 'using correlate function' } },
  { id: 'cquery', type: 'stateNode', position: { x: 200, y: 160 }, data: { label: 'Query Store', status: 'active' } },
  { id: 'cfound', type: 'decisionNode', position: { x: 200, y: 250 }, data: { label: 'Found?', condition: 'exists' } },
  { id: 'cload', type: 'stateNode', position: { x: 50, y: 340 }, data: { label: 'Load existing saga', status: 'success' } },
  { id: 'ccanstart', type: 'decisionNode', position: { x: 350, y: 340 }, data: { label: 'canStart?', condition: 'true' } },
  { id: 'ccreate', type: 'stateNode', position: { x: 250, y: 440 }, data: { label: 'Create new saga', status: 'success' } },
  { id: 'cignore', type: 'stateNode', position: { x: 450, y: 440 }, data: { label: 'Ignore message', status: 'warning' } },
];

export const correlationEdges = [
  { id: 'ce1', source: 'crecv', target: 'cextract', animated: true },
  { id: 'ce2', source: 'cextract', target: 'cquery' },
  { id: 'ce3', source: 'cquery', target: 'cfound' },
  { id: 'ce4', source: 'cfound', target: 'cload', label: 'Found', data: { type: 'success' } },
  { id: 'ce5', source: 'cfound', target: 'ccanstart', label: 'Not Found' },
  { id: 'ce6', source: 'ccanstart', target: 'ccreate', label: 'true', data: { type: 'success' } },
  { id: 'ce7', source: 'ccanstart', target: 'cignore', label: 'false', data: { type: 'error' } },
];

<FlowDiagram nodes={correlationNodes} edges={correlationEdges} height={550} />

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
