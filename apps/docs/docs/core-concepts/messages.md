---
sidebar_position: 2
---

# Messages

Messages are the foundation of saga communication. They represent events, commands, and queries.

## Message Structure

Every message must have a `type` property:

```typescript
interface OrderSubmitted {
  type: 'OrderSubmitted';
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number }>;
  total: number;
  submittedAt: Date;
}
```

## Message Types

### Events

Events describe something that **happened**. Use past tense:

```typescript
// ✅ Good - past tense
interface PaymentCaptured {
  type: 'PaymentCaptured';
  orderId: string;
  transactionId: string;
}

// ❌ Bad - not an event
interface CapturePayment { ... }
```

### Commands

Commands request an action. Use imperative verbs:

```typescript
// ✅ Good - imperative
interface CapturePayment {
  type: 'CapturePayment';
  orderId: string;
  amount: number;
}
```

## Message Envelope

When messages are transported, they're wrapped in an envelope:

```typescript
interface MessageEnvelope<T = unknown> {
  messageId: string;          // Unique message ID
  messageType: string;        // The 'type' property value
  correlationId?: string;     // Business correlation ID
  causationId?: string;       // ID of message that caused this
  timestamp: Date;            // When message was created
  headers: Record<string, string>;  // Custom headers
  payload: T;                 // The actual message
}
```

## Best Practices

### Include Business IDs

Always include the primary business identifier:

```typescript
interface OrderShipped {
  type: 'OrderShipped';
  orderId: string;        // ✅ Primary business ID
  trackingNumber: string;
  carrier: string;
}
```

### Avoid Nested Messages

Keep messages flat:

```typescript
// ✅ Good - flat structure
interface OrderSubmitted {
  type: 'OrderSubmitted';
  orderId: string;
  customerId: string;
  totalAmount: number;
}

// ❌ Avoid - deeply nested
interface OrderSubmitted {
  type: 'OrderSubmitted';
  order: {
    id: string;
    customer: {
      id: string;
    };
  };
}
```

### Use Union Types

Create a union of all messages for type safety:

```typescript
export type OrderMessages =
  | OrderSubmitted
  | PaymentCaptured
  | PaymentFailed
  | OrderShipped
  | OrderCompleted;
```

## Type Inference

The saga DSL infers message types automatically:

```typescript
const saga = createSagaMachine<OrderState, OrderMessages>()
  .on('PaymentCaptured')
    .handle(async (msg, state, ctx) => {
      // TypeScript knows: msg.transactionId exists
      console.log(msg.transactionId);
      return state;
    })
```
