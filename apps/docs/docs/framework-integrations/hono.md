---
sidebar_position: 6
title: Hono
---

# Hono Integration

Lightweight integration for Hono with edge runtime support.

## Installation

```bash npm2yarn
npm install @saga-bus/hono @saga-bus/core hono
```

## Basic Usage

```typescript
import { Hono } from 'hono';
import { sagaBusMiddleware, createHealthRoutes } from '@saga-bus/hono';
import { createBus } from '@saga-bus/core';

const app = new Hono();

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
});

app.use('*', sagaBusMiddleware({ bus }));
app.route('/health', createHealthRoutes(bus));

app.post('/orders', async (c) => {
  const body = await c.req.json();
  const orderId = crypto.randomUUID();

  await c.get('sagaBus').publish({
    type: 'OrderSubmitted',
    orderId,
    ...body,
  });

  return c.json({ orderId }, 201);
});

export default app;
```

## Edge Runtime

### Cloudflare Workers

```typescript
import { Hono } from 'hono';
import { createEdgeBus } from '@saga-bus/core/edge';

type Bindings = {
  SQS_QUEUE_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.post('/orders', async (c) => {
  const bus = createEdgeBus({
    transport: { type: 'sqs', queueUrl: c.env.SQS_QUEUE_URL },
  });

  await bus.publish({ type: 'OrderSubmitted', ...await c.req.json() });
  return c.json({ success: true });
});

export default app;
```

## Middleware Options

```typescript
app.use('*', sagaBusMiddleware({
  bus,
  correlation: {
    header: 'x-correlation-id',
    generate: () => crypto.randomUUID(),
  },
  contextKey: 'sagaBus',
}));
```

## See Also

- [Framework Integrations Overview](/docs/framework-integrations/overview)
- [AWS SQS Transport](/docs/transports/sqs)
