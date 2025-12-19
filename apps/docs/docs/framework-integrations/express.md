---
sidebar_position: 4
title: Express
---

# Express Integration

Middleware and utilities for Express.js applications.

## Installation

```bash npm2yarn
npm install @saga-bus/express @saga-bus/core express
```

## Basic Usage

```typescript
import express from 'express';
import { createBus } from '@saga-bus/core';
import { sagaBusMiddleware, createHealthRouter, setupGracefulShutdown } from '@saga-bus/express';

const app = express();
app.use(express.json());

// Create bus
const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
});

// Add middleware
app.use(sagaBusMiddleware({ bus }));

// Add health check routes
app.use('/health', createHealthRouter(bus));

// Start server
const server = app.listen(3000, async () => {
  await bus.start();
  console.log('Server started');
});

// Graceful shutdown
setupGracefulShutdown(bus, server);
```

## Middleware

### Request Context

```typescript
import { sagaBusMiddleware, getBus } from '@saga-bus/express';

app.use(sagaBusMiddleware({ bus }));

app.post('/orders', async (req, res) => {
  const bus = getBus(req);

  await bus.publish({
    type: 'OrderSubmitted',
    orderId: generateId(),
    ...req.body,
  });

  res.json({ success: true });
});
```

### Correlation ID

```typescript
import { correlationMiddleware } from '@saga-bus/express';

// Automatically extracts/generates correlation ID
app.use(correlationMiddleware());

app.post('/orders', async (req, res) => {
  // Correlation ID available in req.correlationId
  await bus.publish({
    type: 'OrderSubmitted',
    correlationId: req.correlationId,
    ...req.body,
  });
});
```

## Health Checks

### Basic Health Router

```typescript
import { createHealthRouter } from '@saga-bus/express';

app.use('/health', createHealthRouter(bus));

// Endpoints:
// GET /health - Overall health
// GET /health/live - Liveness probe
// GET /health/ready - Readiness probe
```

### Custom Health Checks

```typescript
import { createHealthRouter } from '@saga-bus/express';

app.use('/health', createHealthRouter(bus, {
  checks: {
    database: async () => {
      await pool.query('SELECT 1');
      return { status: 'healthy' };
    },
    redis: async () => {
      await redis.ping();
      return { status: 'healthy' };
    },
  },
  includeDetails: process.env.NODE_ENV !== 'production',
}));
```

### Health Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "transport": { "status": "healthy" },
    "store": { "status": "healthy" },
    "database": { "status": "healthy" }
  }
}
```

## Graceful Shutdown

```typescript
import { setupGracefulShutdown } from '@saga-bus/express';

const server = app.listen(3000);

setupGracefulShutdown(bus, server, {
  timeout: 30000, // Max 30s for shutdown
  signals: ['SIGTERM', 'SIGINT'],
  onShutdown: async () => {
    console.log('Shutting down...');
    await closeOtherConnections();
  },
});
```

### Manual Shutdown

```typescript
import { gracefulShutdown } from '@saga-bus/express';

process.on('SIGTERM', async () => {
  await gracefulShutdown(bus, server, { timeout: 30000 });
  process.exit(0);
});
```

## Error Handling

### Error Middleware

```typescript
import { sagaErrorHandler } from '@saga-bus/express';

// Add after all routes
app.use(sagaErrorHandler({
  logger: console,
  includeStack: process.env.NODE_ENV !== 'production',
}));
```

### Custom Error Handler

```typescript
app.post('/orders', async (req, res, next) => {
  try {
    await bus.publish({ type: 'OrderSubmitted', ...req.body });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  if (error.name === 'SagaPublishError') {
    return res.status(503).json({
      error: 'Service temporarily unavailable',
    });
  }
  next(error);
});
```

## Full Example

```typescript
import express from 'express';
import { createBus } from '@saga-bus/core';
import { RabbitMqTransport } from '@saga-bus/transport-rabbitmq';
import { PostgresSagaStore } from '@saga-bus/store-postgres';
import {
  sagaBusMiddleware,
  correlationMiddleware,
  createHealthRouter,
  setupGracefulShutdown,
  sagaErrorHandler,
} from '@saga-bus/express';

const app = express();
app.use(express.json());
app.use(correlationMiddleware());

// Create bus
const transport = new RabbitMqTransport({ url: process.env.RABBITMQ_URL });
const store = new PostgresSagaStore({ connectionString: process.env.DATABASE_URL });

const bus = createBus({
  transport,
  store,
  sagas: [
    { definition: orderSaga },
    { definition: paymentSaga },
  ],
});

// Middleware
app.use(sagaBusMiddleware({ bus }));

// Health
app.use('/health', createHealthRouter(bus));

// Routes
app.post('/orders', async (req, res) => {
  const orderId = crypto.randomUUID();

  await bus.publish({
    type: 'OrderSubmitted',
    orderId,
    correlationId: req.correlationId,
    ...req.body,
  });

  res.status(201).json({ orderId });
});

app.get('/orders/:id', async (req, res) => {
  const state = await store.getByCorrelationId('OrderSaga', req.params.id);

  if (!state) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json(state);
});

// Error handling
app.use(sagaErrorHandler());

// Start
const server = app.listen(3000, async () => {
  await bus.start();
  console.log('Server running on port 3000');
});

setupGracefulShutdown(bus, server);
```

## Docker Setup

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## See Also

- [Framework Integrations Overview](/docs/framework-integrations/overview)
- [Health Checks](/docs/production/health-checks)
- [Deployment](/docs/production/deployment)
