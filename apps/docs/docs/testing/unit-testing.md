---
sidebar_position: 3
title: Unit Testing
---

# Unit Testing

Test individual saga handlers in isolation.

## Testing Handler Logic

Extract and test handler logic directly:

```typescript
import { describe, it, expect, vi } from 'vitest';

// Define handler logic separately for testability
function handlePaymentCaptured(state: OrderState, message: PaymentCaptured) {
  return {
    ...state,
    status: 'paid',
    transactionId: message.transactionId,
  };
}

describe('PaymentCaptured handler', () => {
  it('updates status to paid', () => {
    const state = {
      orderId: '123',
      status: 'pending',
      customerId: 'cust-456',
    };

    const message = {
      type: 'PaymentCaptured',
      transactionId: 'txn-789',
    };

    const newState = handlePaymentCaptured(state, message);

    expect(newState.status).toBe('paid');
    expect(newState.transactionId).toBe('txn-789');
    expect(newState.orderId).toBe('123'); // Unchanged
  });
});
```

## Testing with Mock Context

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createMockContext } from '@saga-bus/test';

describe('OrderSubmitted handler', () => {
  it('publishes PaymentRequested', async () => {
    const ctx = createMockContext({
      state: { orderId: '', status: 'initial' },
      message: {
        type: 'OrderSubmitted',
        orderId: '123',
        customerId: 'cust-456',
        total: 99.99,
      },
    });

    await orderSaga.handlers.OrderSubmitted(ctx);

    // Check state changes
    expect(ctx.setState).toHaveBeenCalledWith({
      orderId: '123',
      status: 'submitted',
      customerId: 'cust-456',
    });

    // Check published messages
    expect(ctx.publish).toHaveBeenCalledWith({
      type: 'PaymentRequested',
      orderId: '123',
      amount: 99.99,
    });
  });

  it('marks saga as completed on final state', async () => {
    const ctx = createMockContext({
      state: { orderId: '123', status: 'paid' },
      message: {
        type: 'InventoryReserved',
        orderId: '123',
      },
    });

    await orderSaga.handlers.InventoryReserved(ctx);

    expect(ctx.complete).toHaveBeenCalled();
  });
});
```

## Creating Mock Context

### Manual Mock

```typescript
function createMockContext<TState>(options: {
  state: TState;
  message: unknown;
}) {
  return {
    state: options.state,
    message: options.message,
    setState: vi.fn(),
    publish: vi.fn(),
    complete: vi.fn(),
    correlationId: 'test-correlation-id',
    sagaId: 'test-saga-id',
    metadata: new Map(),
  };
}
```

### Using Test Package

```typescript
import { createMockContext } from '@saga-bus/test';

const ctx = createMockContext({
  state: initialState,
  message: testMessage,
  correlationId: 'custom-correlation-id',
});
```

## Testing Error Cases

```typescript
describe('Error handling', () => {
  it('throws on invalid state transition', async () => {
    const ctx = createMockContext({
      state: { orderId: '123', status: 'completed' },
      message: {
        type: 'PaymentCaptured',
        orderId: '123',
      },
    });

    await expect(
      orderSaga.handlers.PaymentCaptured(ctx)
    ).rejects.toThrow('Cannot capture payment for completed order');
  });

  it('handles missing required fields', async () => {
    const ctx = createMockContext({
      state: { orderId: '', status: 'initial' },
      message: {
        type: 'OrderSubmitted',
        // Missing orderId
        customerId: 'cust-456',
      },
    });

    await expect(
      orderSaga.handlers.OrderSubmitted(ctx)
    ).rejects.toThrow('orderId is required');
  });
});
```

## Testing with Dependencies

### Injecting Mocks

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('OrderSaga with dependencies', () => {
  const mockPaymentService = {
    capture: vi.fn(),
    refund: vi.fn(),
  };

  const mockInventoryService = {
    reserve: vi.fn(),
    release: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('captures payment successfully', async () => {
    mockPaymentService.capture.mockResolvedValue({
      transactionId: 'txn-123',
    });

    const ctx = createMockContext({
      state: { orderId: '123', status: 'submitted' },
      message: { type: 'RequestPayment', orderId: '123', amount: 99.99 },
    });

    // Create saga with injected dependencies
    const saga = createOrderSaga({
      paymentService: mockPaymentService,
      inventoryService: mockInventoryService,
    });

    await saga.handlers.RequestPayment(ctx);

    expect(mockPaymentService.capture).toHaveBeenCalledWith({
      orderId: '123',
      amount: 99.99,
    });
  });
});
```

## Testing State Machine

```typescript
describe('OrderSaga state machine', () => {
  const transitions = [
    { from: 'initial', event: 'OrderSubmitted', to: 'submitted' },
    { from: 'submitted', event: 'PaymentCaptured', to: 'paid' },
    { from: 'paid', event: 'InventoryReserved', to: 'completed' },
    { from: 'submitted', event: 'PaymentFailed', to: 'failed' },
  ];

  test.each(transitions)(
    'transitions from $from to $to on $event',
    async ({ from, event, to }) => {
      const ctx = createMockContext({
        state: { status: from },
        message: { type: event },
      });

      await orderSaga.handlers[event](ctx);

      expect(ctx.setState).toHaveBeenCalledWith(
        expect.objectContaining({ status: to })
      );
    }
  );
});
```

## Best Practices

### Keep Handlers Pure

```typescript
// Good - pure function
function handlePaymentCaptured(state, message) {
  return { ...state, status: 'paid' };
}

// Avoid - side effects in handler logic
function handlePaymentCaptured(state, message) {
  sendEmail(state.customerId); // Side effect!
  return { ...state, status: 'paid' };
}
```

### Test Edge Cases

```typescript
describe('Edge cases', () => {
  it('handles duplicate messages', async () => {
    // Already processed
    const ctx = createMockContext({
      state: { orderId: '123', status: 'paid' },
      message: { type: 'PaymentCaptured' },
    });

    await orderSaga.handlers.PaymentCaptured(ctx);

    // Should be idempotent
    expect(ctx.setState).not.toHaveBeenCalled();
  });
});
```

## See Also

- [Testing Overview](/docs/testing/overview)
- [Integration Testing](/docs/testing/integration-testing)
- [Mocking](/docs/testing/mocking)
