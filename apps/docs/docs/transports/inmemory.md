---
sidebar_position: 2
---

# In-Memory Transport

Testing transport with no external dependencies.

## Installation

```bash npm2yarn
npm install @saga-bus/transport-inmemory
```

## Usage

```typescript
import { InMemoryTransport } from '@saga-bus/transport-inmemory';

const transport = new InMemoryTransport();

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
});
```

## When to Use

- Unit tests
- Integration tests
- Local development
- Prototyping

## Limitations

- No persistence between restarts
- Single process only
- No message ordering guarantees

## Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { InMemoryTransport } from '@saga-bus/transport-inmemory';
import { InMemorySagaStore } from '@saga-bus/store-inmemory';

describe('OrderSaga', () => {
  it('processes order flow', async () => {
    const transport = new InMemoryTransport();
    const store = new InMemorySagaStore();
    
    const bus = createBus({ transport, store, sagas: [{ definition: orderSaga }] });
    await bus.start();
    
    await bus.publish({ type: 'OrderSubmitted', orderId: '123', ... });
    // assertions...
    
    await bus.stop();
  });
});
```
