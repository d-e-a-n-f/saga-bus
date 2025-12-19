---
sidebar_position: 2
title: Test Harness
---

# Test Harness

Coming soon. See package README for details.

## Installation

```bash
npm install -D @saga-bus/test
```

## Usage

```typescript
import { TestHarness } from '@saga-bus/test';

const harness = new TestHarness();
await harness.start({ sagas: [{ definition: orderSaga }] });

await harness.publish({ type: 'OrderSubmitted', orderId: '123' });
await harness.waitForSaga('OrderSaga', '123');

const state = await harness.getSagaState('OrderSaga', '123');
expect(state.status).toBe('pending');
```
