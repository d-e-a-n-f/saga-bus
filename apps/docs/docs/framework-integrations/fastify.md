---
sidebar_position: 5
title: Fastify
---

# Fastify Integration

High-performance Fastify plugin with full TypeScript support.

## Installation

```bash npm2yarn
npm install @saga-bus/fastify @saga-bus/core fastify
```

## Basic Usage

```typescript
import Fastify from 'fastify';
import { sagaBusPlugin } from '@saga-bus/fastify';
import { createBus } from '@saga-bus/core';

const fastify = Fastify({ logger: true });

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
});

await fastify.register(sagaBusPlugin, { bus });
await fastify.listen({ port: 3000 });
```

## Plugin Options

```typescript
await fastify.register(sagaBusPlugin, {
  bus,
  healthCheck: {
    enabled: true,
    path: '/health',
  },
  correlation: {
    header: 'x-correlation-id',
    generate: true,
  },
  gracefulShutdown: {
    timeout: 30000,
  },
});
```

## Routes

```typescript
fastify.post('/orders', async (request, reply) => {
  const orderId = crypto.randomUUID();

  await fastify.sagaBus.publish({
    type: 'OrderSubmitted',
    orderId,
    correlationId: request.correlationId,
    ...request.body,
  });

  return { orderId };
});
```

## Health Checks

```typescript
await fastify.register(sagaBusPlugin, {
  bus,
  healthCheck: {
    enabled: true,
    paths: {
      liveness: '/health/live',
      readiness: '/health/ready',
    },
  },
});
```

## See Also

- [Framework Integrations Overview](/docs/framework-integrations/overview)
- [Express Integration](/docs/framework-integrations/express)
- [Health Checks](/docs/production/health-checks)
