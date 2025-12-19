---
sidebar_position: 5
title: Mocking
---

# Mocking

Mock transports, stores, and external services for testing.

## Mocking External Services

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPaymentService = {
  capture: vi.fn(),
  refund: vi.fn(),
};

const mockInventoryService = {
  reserve: vi.fn(),
  release: vi.fn(),
};

describe('Order processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockPaymentService.capture.mockResolvedValue({
      transactionId: 'txn-123',
      status: 'captured',
    });

    mockInventoryService.reserve.mockResolvedValue({
      reservationId: 'res-456',
    });
  });

  it('processes payment', async () => {
    // Test with mocked services
    const saga = createOrderSaga({
      paymentService: mockPaymentService,
      inventoryService: mockInventoryService,
    });

    // ...test saga
  });
});
```

## Mocking Transport

### In-Memory Transport

```typescript
import { InMemoryTransport } from '@saga-bus/transport-inmemory';

const transport = new InMemoryTransport();

// Spy on publish
const publishSpy = vi.spyOn(transport, 'publish');

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
});

// Verify message was published
expect(publishSpy).toHaveBeenCalledWith(
  expect.objectContaining({
    type: 'PaymentRequested',
  }),
  expect.any(Object)
);
```

### Mock Transport

```typescript
import { createMockTransport } from '@saga-bus/test';

const mockTransport = createMockTransport();

// Configure behavior
mockTransport.onPublish('PaymentRequested', async (msg) => {
  // Simulate external service response
  await mockTransport.receive({
    type: 'PaymentCaptured',
    orderId: msg.orderId,
    transactionId: 'txn-' + Date.now(),
  });
});

const bus = createBus({
  transport: mockTransport,
  store,
  sagas: [{ definition: orderSaga }],
});
```

## Mocking Store

### In-Memory Store

```typescript
import { InMemorySagaStore } from '@saga-bus/store-inmemory';

const store = new InMemorySagaStore();

// Pre-populate state
await store.insert('OrderSaga', 'order-123', {
  orderId: 'order-123',
  status: 'paid',
  transactionId: 'txn-456',
});

// Test saga with existing state
const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
});
```

### Mock Store

```typescript
import { createMockStore } from '@saga-bus/test';

const mockStore = createMockStore();

// Configure responses
mockStore.getByCorrelationId.mockResolvedValue({
  orderId: '123',
  status: 'pending',
});

mockStore.update.mockRejectedValueOnce(
  new ConcurrencyError('Version conflict')
);
```

## Simulating Failures

### Transport Failures

```typescript
const mockTransport = createMockTransport();

// Fail first 2 publish attempts
let attempts = 0;
mockTransport.publish = vi.fn().mockImplementation(async () => {
  if (++attempts <= 2) {
    throw new Error('Connection failed');
  }
});

// Test retry behavior
```

### Store Failures

```typescript
const mockStore = createMockStore();

// Simulate concurrency conflict
mockStore.update.mockRejectedValueOnce(
  new ConcurrencyError('Version mismatch')
);

// Second attempt succeeds
mockStore.update.mockResolvedValueOnce(undefined);
```

### Timeout Simulation

```typescript
const mockPaymentService = {
  capture: vi.fn().mockImplementation(
    () => new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 100)
    )
  ),
};
```

## Testing with Fake Time

### Vitest Fake Timers

```typescript
import { vi, describe, it, beforeEach, afterEach } from 'vitest';

describe('Timeout handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers timeout after delay', async () => {
    await harness.publish({
      type: 'OrderSubmitted',
      orderId: '123',
    });

    // Advance time
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    // Timeout should have triggered
    const state = await harness.getSagaState('OrderSaga', '123');
    expect(state.status).toBe('timeout');
  });
});
```

### TestHarness Time Control

```typescript
// Advance harness time
await harness.advanceTime(5 * 60 * 1000);

// Set specific time
await harness.setTime(new Date('2024-01-15T12:00:00Z'));
```

## Mocking HTTP Services

```typescript
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.post('https://api.payment.com/capture', () => {
    return HttpResponse.json({
      transactionId: 'txn-123',
      status: 'captured',
    });
  }),

  http.post('https://api.inventory.com/reserve', () => {
    return HttpResponse.json({
      reservationId: 'res-456',
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('integrates with payment API', async () => {
  // Test with mocked HTTP endpoints
});
```

## Creating Test Fixtures

```typescript
// fixtures/orders.ts
export const pendingOrder = {
  orderId: 'order-123',
  status: 'pending',
  customerId: 'cust-456',
  items: [
    { productId: 'prod-1', quantity: 2, price: 50 },
  ],
  total: 100,
  createdAt: new Date('2024-01-15T10:00:00Z'),
};

export const paidOrder = {
  ...pendingOrder,
  status: 'paid',
  transactionId: 'txn-789',
  paidAt: new Date('2024-01-15T10:05:00Z'),
};

export const completedOrder = {
  ...paidOrder,
  status: 'completed',
  reservationId: 'res-001',
  completedAt: new Date('2024-01-15T10:10:00Z'),
};

// Usage
import { pendingOrder, paidOrder } from './fixtures/orders';

it('transitions from pending to paid', async () => {
  await store.insert('OrderSaga', pendingOrder.orderId, pendingOrder);
  // ...
});
```

## Mock Factory Functions

```typescript
// test/factories.ts
export function createMockContext<TState>(
  overrides: Partial<SagaContext<TState>> = {}
) {
  return {
    state: {} as TState,
    message: {},
    setState: vi.fn(),
    publish: vi.fn(),
    complete: vi.fn(),
    correlationId: 'test-corr-id',
    sagaId: 'test-saga-id',
    metadata: new Map(),
    ...overrides,
  };
}

export function createMockPaymentService() {
  return {
    capture: vi.fn().mockResolvedValue({ transactionId: 'txn-mock' }),
    refund: vi.fn().mockResolvedValue({ refundId: 'ref-mock' }),
  };
}
```

## See Also

- [Testing Overview](/docs/testing/overview)
- [Unit Testing](/docs/testing/unit-testing)
- [Integration Testing](/docs/testing/integration-testing)
