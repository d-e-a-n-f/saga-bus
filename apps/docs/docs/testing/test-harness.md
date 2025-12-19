---
sidebar_position: 2
title: Test Harness
---

# Test Harness

The TestHarness provides utilities for testing sagas with in-memory transport and store.

## Installation

```bash npm2yarn
npm install -D @saga-bus/test
```

## Basic Usage

```typescript
import { TestHarness } from '@saga-bus/test';
import { orderSaga } from './sagas/order-saga';

const harness = new TestHarness();

await harness.start({
  sagas: [{ definition: orderSaga }],
});

// Publish a message
await harness.publish({
  type: 'OrderSubmitted',
  orderId: '123',
  customerId: 'cust-456',
  total: 99.99,
});

// Wait for saga to process
await harness.waitForSaga('OrderSaga', '123');

// Get saga state
const state = await harness.getSagaState('OrderSaga', '123');
expect(state.status).toBe('submitted');

await harness.stop();
```

## Configuration

```typescript
const harness = new TestHarness({
  // Process messages synchronously (default: true)
  synchronous: true,

  // Timeout for waitFor methods (default: 5000ms)
  defaultTimeout: 5000,

  // Enable debug logging
  debug: false,
});
```

## API Reference

### `start(options)`

Start the harness with saga registrations.

```typescript
await harness.start({
  sagas: [
    { definition: orderSaga },
    { definition: paymentSaga },
  ],
  middleware: [
    createLoggingMiddleware({ level: 'debug' }),
  ],
});
```

### `publish(message)`

Publish a message to be processed.

```typescript
await harness.publish({
  type: 'OrderSubmitted',
  orderId: '123',
  customerId: 'cust-456',
});
```

### `waitForSaga(sagaName, correlationId, options?)`

Wait for a saga instance to reach a certain state.

```typescript
// Wait for saga to exist
await harness.waitForSaga('OrderSaga', '123');

// Wait for specific status
await harness.waitForSaga('OrderSaga', '123', {
  status: 'paid',
});

// Wait for completion
await harness.waitForSaga('OrderSaga', '123', {
  completed: true,
});

// Custom timeout
await harness.waitForSaga('OrderSaga', '123', {
  timeout: 10000,
});
```

### `waitForMessage(messageType, predicate?)`

Wait for a specific message to be published.

```typescript
// Wait for any message of type
const msg = await harness.waitForMessage('PaymentRequested');

// Wait for message matching predicate
const msg = await harness.waitForMessage('PaymentRequested', (m) =>
  m.orderId === '123'
);
```

### `getSagaState(sagaName, correlationId)`

Get the current state of a saga instance.

```typescript
const state = await harness.getSagaState('OrderSaga', '123');
console.log(state.status); // 'paid'
```

### `getPublishedMessages(messageType?)`

Get all messages published during the test.

```typescript
// All messages
const allMessages = harness.getPublishedMessages();

// Messages of specific type
const payments = harness.getPublishedMessages('PaymentRequested');
```

### `stop()`

Stop the harness and clean up resources.

```typescript
await harness.stop();
```

## Test Patterns

### Setup and Teardown

```typescript
import { TestHarness } from '@saga-bus/test';

describe('OrderSaga', () => {
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

  it('test case', async () => {
    // ...
  });
});
```

### Testing State Transitions

```typescript
it('transitions from pending to paid', async () => {
  // Start saga
  await harness.publish({
    type: 'OrderSubmitted',
    orderId: '123',
  });
  await harness.waitForSaga('OrderSaga', '123', { status: 'pending' });

  // Transition to paid
  await harness.publish({
    type: 'PaymentCaptured',
    orderId: '123',
    transactionId: 'txn-1',
  });
  await harness.waitForSaga('OrderSaga', '123', { status: 'paid' });

  const state = await harness.getSagaState('OrderSaga', '123');
  expect(state.status).toBe('paid');
  expect(state.transactionId).toBe('txn-1');
});
```

### Verifying Published Messages

```typescript
it('requests payment after order submitted', async () => {
  await harness.publish({
    type: 'OrderSubmitted',
    orderId: '123',
    total: 99.99,
  });

  await harness.waitForMessage('PaymentRequested');

  const messages = harness.getPublishedMessages('PaymentRequested');
  expect(messages).toHaveLength(1);
  expect(messages[0].orderId).toBe('123');
  expect(messages[0].amount).toBe(99.99);
});
```

### Testing Timeouts

```typescript
it('handles timeout', async () => {
  await harness.publish({ type: 'OrderSubmitted', orderId: '123' });
  await harness.waitForSaga('OrderSaga', '123');

  // Advance time
  await harness.advanceTime(5 * 60 * 1000); // 5 minutes

  // Timeout should trigger
  await harness.waitForMessage('PaymentTimeout');
});
```

## See Also

- [Testing Overview](/docs/testing/overview)
- [Unit Testing](/docs/testing/unit-testing)
- [Integration Testing](/docs/testing/integration-testing)
