---
sidebar_position: 1
---

# Testing Overview

Strategies for testing saga-based applications.

## Testing Levels

export const testNodes = [
  { id: 'e2e', type: 'stateNode', position: { x: 150, y: 0 }, data: { label: 'E2E Tests', description: 'Full system with real infra', status: 'active' } },
  { id: 'integration', type: 'stateNode', position: { x: 150, y: 90 }, data: { label: 'Integration Tests', description: 'Saga flows with in-memory', status: 'active' } },
  { id: 'unit', type: 'stateNode', position: { x: 150, y: 180 }, data: { label: 'Unit Tests', description: 'Individual handlers', status: 'success' } },
];

export const testEdges = [
  { id: 'te1', source: 'e2e', target: 'integration' },
  { id: 'te2', source: 'integration', target: 'unit' },
];

<FlowDiagram nodes={testNodes} edges={testEdges} height={280} />

## Test Harness

The `@saga-bus/test` package provides utilities:

```bash npm2yarn
npm install -D @saga-bus/test
```

```typescript
import { TestHarness } from '@saga-bus/test';

const harness = new TestHarness();
await harness.start({ sagas: [{ definition: orderSaga }] });

await harness.publish({ type: 'OrderSubmitted', orderId: '123', ... });
await harness.waitForSaga('OrderSaga', '123');

const state = await harness.getSagaState('OrderSaga', '123');
expect(state.status).toBe('pending');
```

## Quick Examples

### Unit Test

```typescript
import { describe, it, expect } from 'vitest';

describe('Order handler', () => {
  it('transitions to paid on PaymentCaptured', async () => {
    const state = { orderId: '123', status: 'pending' };
    const msg = { type: 'PaymentCaptured', transactionId: 'txn' };

    const newState = await orderSaga.handlers.PaymentCaptured(msg, state, mockCtx);

    expect(newState.status).toBe('paid');
  });
});
```

### Integration Test

```typescript
describe('Order flow', () => {
  it('completes order', async () => {
    const harness = new TestHarness();
    await harness.start({ sagas: [{ definition: orderSaga }] });

    await harness.publish({ type: 'OrderSubmitted', orderId: '123' });
    await harness.publish({ type: 'PaymentCaptured', orderId: '123' });
    await harness.publish({ type: 'InventoryReserved', orderId: '123' });

    const state = await harness.getSagaState('OrderSaga', '123');
    expect(state.status).toBe('completed');
  });
});
```

## Sections

- [Test Harness](/docs/testing/test-harness) - Using TestHarness
- [Unit Testing](/docs/testing/unit-testing) - Testing handlers
- [Integration Testing](/docs/testing/integration-testing) - Full flows
- [Mocking](/docs/testing/mocking) - Mock transports and stores
