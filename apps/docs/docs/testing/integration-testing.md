---
sidebar_position: 4
title: Integration Testing
---

# Integration Testing

Test complete saga flows with the TestHarness.

## Full Flow Testing

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestHarness } from '@saga-bus/test';
import { orderSaga } from './sagas/order-saga';

describe('Order flow', () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = new TestHarness();
    await harness.start({
      sagas: [{ definition: orderSaga }],
    });
  });

  afterEach(async () => {
    await harness.stop();
  });

  it('completes order flow', async () => {
    // 1. Submit order
    await harness.publish({
      type: 'OrderSubmitted',
      orderId: 'order-123',
      customerId: 'cust-456',
      items: [{ productId: 'prod-1', quantity: 2, price: 50 }],
      total: 100,
    });

    // 2. Wait for payment request
    const paymentRequest = await harness.waitForMessage('PaymentRequested');
    expect(paymentRequest.amount).toBe(100);

    // 3. Simulate payment captured
    await harness.publish({
      type: 'PaymentCaptured',
      orderId: 'order-123',
      transactionId: 'txn-789',
    });

    // 4. Wait for inventory reservation
    await harness.waitForMessage('ReserveInventory');

    // 5. Simulate inventory reserved
    await harness.publish({
      type: 'InventoryReserved',
      orderId: 'order-123',
      reservationId: 'res-001',
    });

    // 6. Verify final state
    const state = await harness.getSagaState('OrderSaga', 'order-123');
    expect(state.status).toBe('completed');
    expect(state.transactionId).toBe('txn-789');
    expect(state.reservationId).toBe('res-001');
  });
});
```

## Testing Multiple Sagas

```typescript
describe('Multi-saga interaction', () => {
  beforeEach(async () => {
    harness = new TestHarness();
    await harness.start({
      sagas: [
        { definition: orderSaga },
        { definition: paymentSaga },
        { definition: inventorySaga },
      ],
    });
  });

  it('coordinates across sagas', async () => {
    await harness.publish({
      type: 'OrderSubmitted',
      orderId: '123',
      total: 100,
    });

    // Order saga publishes PaymentRequested
    // Payment saga handles it and publishes PaymentCaptured
    // Order saga handles PaymentCaptured...

    await harness.waitForSaga('OrderSaga', '123', { status: 'completed' });
  });
});
```

## Testing Compensation

```typescript
describe('Compensation flow', () => {
  it('compensates on failure', async () => {
    // Start order
    await harness.publish({
      type: 'OrderSubmitted',
      orderId: '123',
      total: 100,
    });

    // Payment succeeds
    await harness.publish({
      type: 'PaymentCaptured',
      orderId: '123',
      transactionId: 'txn-1',
    });

    // Inventory fails
    await harness.publish({
      type: 'InventoryFailed',
      orderId: '123',
      reason: 'Out of stock',
    });

    // Verify refund was requested
    const refundMsg = await harness.waitForMessage('RefundRequested');
    expect(refundMsg.transactionId).toBe('txn-1');

    // Complete refund
    await harness.publish({
      type: 'RefundCompleted',
      orderId: '123',
    });

    // Verify final state
    const state = await harness.getSagaState('OrderSaga', '123');
    expect(state.status).toBe('cancelled');
  });
});
```

## Testing Timeouts

```typescript
describe('Timeout handling', () => {
  it('handles payment timeout', async () => {
    await harness.publish({
      type: 'OrderSubmitted',
      orderId: '123',
    });

    await harness.waitForSaga('OrderSaga', '123', { status: 'submitted' });

    // Advance time past timeout
    await harness.advanceTime(5 * 60 * 1000); // 5 minutes

    // Timeout should trigger
    await harness.waitForMessage('PaymentTimeout');

    const state = await harness.getSagaState('OrderSaga', '123');
    expect(state.status).toBe('payment_timeout');
  });
});
```

## Testing with Real Database

```typescript
import { PostgresSagaStore } from '@saga-bus/store-postgres';
import { Pool } from 'pg';

describe('Integration with PostgreSQL', () => {
  let pool: Pool;
  let harness: TestHarness;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    await createSchema(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Clean database
    await pool.query('TRUNCATE sagas');

    const store = new PostgresSagaStore({ pool });
    harness = new TestHarness({ store });
    await harness.start({
      sagas: [{ definition: orderSaga }],
    });
  });

  it('persists saga state', async () => {
    await harness.publish({
      type: 'OrderSubmitted',
      orderId: '123',
    });

    await harness.waitForSaga('OrderSaga', '123');

    // Verify in database
    const result = await pool.query(
      'SELECT * FROM sagas WHERE correlation_id = $1',
      ['123']
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].state.status).toBe('submitted');
  });
});
```

## Testing Concurrent Messages

```typescript
describe('Concurrent processing', () => {
  it('handles concurrent messages correctly', async () => {
    await harness.publish({
      type: 'OrderSubmitted',
      orderId: '123',
    });

    // Publish multiple messages concurrently
    await Promise.all([
      harness.publish({ type: 'PaymentCaptured', orderId: '123' }),
      harness.publish({ type: 'CustomerUpdated', orderId: '123' }),
      harness.publish({ type: 'ShippingCalculated', orderId: '123' }),
    ]);

    await harness.waitForSaga('OrderSaga', '123', { status: 'paid' });

    // All messages should be processed
    const state = await harness.getSagaState('OrderSaga', '123');
    expect(state).toBeDefined();
  });
});
```

## Debugging Tests

```typescript
const harness = new TestHarness({
  debug: true, // Enable debug logging
});

// Log all published messages
harness.onMessage((msg) => {
  console.log('Message:', msg);
});

// Log state changes
harness.onStateChange((sagaName, correlationId, state) => {
  console.log(`${sagaName}[${correlationId}]:`, state);
});
```

## Best Practices

### Use Realistic Test Data

```typescript
import { faker } from '@faker-js/faker';

const testOrder = {
  type: 'OrderSubmitted',
  orderId: faker.string.uuid(),
  customerId: faker.string.uuid(),
  items: [
    {
      productId: faker.string.uuid(),
      quantity: faker.number.int({ min: 1, max: 10 }),
      price: faker.number.float({ min: 10, max: 1000 }),
    },
  ],
};
```

### Isolate Tests

```typescript
// Each test gets fresh harness
beforeEach(async () => {
  harness = new TestHarness();
  await harness.start({ ... });
});

afterEach(async () => {
  await harness.stop();
});
```

### Test Error Recovery

```typescript
it('recovers from transient failure', async () => {
  // Simulate failure
  harness.simulateFailure('PaymentService', 2); // Fail first 2 attempts

  await harness.publish({ type: 'OrderSubmitted', orderId: '123' });

  // Should eventually succeed with retries
  await harness.waitForSaga('OrderSaga', '123', {
    status: 'paid',
    timeout: 30000,
  });
});
```

## See Also

- [Testing Overview](/docs/testing/overview)
- [Test Harness](/docs/testing/test-harness)
- [Mocking](/docs/testing/mocking)
