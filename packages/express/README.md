# @saga-bus/express

Express.js integration for saga-bus with middleware, health checks, and graceful shutdown.

## Installation

```bash
npm install @saga-bus/express express
# or
pnpm add @saga-bus/express express
```

## Features

- **Bus Middleware**: Attaches bus instance to `req.bus`
- **Correlation ID**: Extract or generate correlation IDs from headers
- **Health Checks**: Ready-to-use health and readiness endpoints
- **Error Handler**: Saga-specific error handling middleware
- **Graceful Shutdown**: Clean shutdown with bus draining

## Quick Start

```typescript
import express from "express";
import { createBus } from "@saga-bus/core";
import {
  sagaBusMiddleware,
  sagaErrorHandler,
  createHealthRouter,
  setupGracefulShutdown,
} from "@saga-bus/express";

const bus = createBus({ /* config */ });
await bus.start();

const app = express();

// Attach bus to requests
app.use(sagaBusMiddleware({ bus }));

// Health check endpoint
app.use(createHealthRouter({ bus }));

// Your routes
app.post("/orders", async (req, res) => {
  await req.bus.publish({
    type: "CreateOrder",
    payload: req.body,
  });
  res.json({ correlationId: req.correlationId });
});

// Error handler (must be last)
app.use(sagaErrorHandler());

const server = app.listen(3000);

// Graceful shutdown
setupGracefulShutdown(server, { bus });
```

## API Reference

### sagaBusMiddleware(options)

Creates middleware that attaches the bus instance to requests.

```typescript
interface SagaBusExpressOptions {
  /** The bus instance to attach */
  bus: Bus;

  /** Header name for correlation ID (default: "x-correlation-id") */
  correlationIdHeader?: string;

  /** Whether to generate correlation ID if not present (default: true) */
  generateCorrelationId?: boolean;

  /** Custom correlation ID generator */
  correlationIdGenerator?: () => string;
}
```

Example:

```typescript
app.use(sagaBusMiddleware({
  bus,
  correlationIdHeader: "x-request-id",
  correlationIdGenerator: () => `req-${Date.now()}`,
}));
```

### sagaErrorHandler()

Error handler middleware for saga-related errors.

- **SagaTimeoutError**: Returns 408 Request Timeout
- **ConcurrencyError**: Returns 409 Conflict

```typescript
app.use(sagaErrorHandler());
```

### createHealthRouter(options)

Creates a health check router.

```typescript
interface HealthCheckOptions {
  /** The bus instance to check */
  bus: Bus;

  /** Path for health endpoint (default: "/health") */
  path?: string;

  /** Additional health checks */
  checks?: Array<{
    name: string;
    check: () => Promise<boolean>;
  }>;
}
```

Example:

```typescript
app.use(createHealthRouter({
  bus,
  path: "/health",
  checks: [
    {
      name: "database",
      check: async () => {
        await pool.query("SELECT 1");
        return true;
      },
    },
  ],
}));
```

Response format:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "bus": { "status": "pass" },
    "database": { "status": "pass" }
  }
}
```

### createReadinessRouter(options)

Same as `createHealthRouter` but defaults to `/ready` path.

```typescript
app.use(createReadinessRouter({ bus }));
```

### setupGracefulShutdown(server, options)

Sets up graceful shutdown with bus draining.

```typescript
interface GracefulShutdownOptions {
  /** The bus instance to drain */
  bus: Bus;

  /** Timeout for graceful shutdown in ms (default: 30000) */
  timeoutMs?: number;

  /** Callback before shutdown starts */
  onShutdownStart?: () => void | Promise<void>;

  /** Callback after shutdown completes */
  onShutdownComplete?: () => void | Promise<void>;
}
```

Example:

```typescript
setupGracefulShutdown(server, {
  bus,
  timeoutMs: 60000,
  onShutdownStart: async () => {
    console.log("Stopping background jobs...");
  },
  onShutdownComplete: async () => {
    await pool.end();
    console.log("Cleanup complete");
  },
});
```

## TypeScript Support

The package extends Express types to add `bus` and `correlationId` to requests:

```typescript
// In your route handlers
app.post("/orders", async (req, res) => {
  // req.bus is typed as Bus
  await req.bus.publish(message);

  // req.correlationId is typed as string | undefined
  console.log(`Processing ${req.correlationId}`);
});
```

## Example: Complete Application

```typescript
import express from "express";
import { createBus, InMemoryTransport, InMemorySagaStore } from "@saga-bus/core";
import {
  sagaBusMiddleware,
  sagaErrorHandler,
  createHealthRouter,
  createReadinessRouter,
  setupGracefulShutdown,
} from "@saga-bus/express";

// Create bus
const bus = createBus({
  transport: new InMemoryTransport(),
  store: new InMemorySagaStore(),
});

await bus.start();

// Create Express app
const app = express();
app.use(express.json());

// Saga bus middleware
app.use(sagaBusMiddleware({ bus }));

// Health endpoints
app.use(createHealthRouter({ bus }));
app.use(createReadinessRouter({ bus }));

// Routes
app.post("/messages", async (req, res) => {
  await req.bus.publish({
    type: req.body.type,
    payload: req.body.payload,
  });
  res.json({ success: true, correlationId: req.correlationId });
});

// Error handler (must be last middleware)
app.use(sagaErrorHandler());

// Start server
const server = app.listen(3000, () => {
  console.log("Server running on port 3000");
});

// Graceful shutdown
setupGracefulShutdown(server, {
  bus,
  timeoutMs: 30000,
});
```

## License

MIT
