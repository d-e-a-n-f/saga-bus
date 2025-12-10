# @saga-bus/fastify

Fastify plugin for saga-bus with lifecycle management, request decoration, and health checks.

## Installation

```bash
npm install @saga-bus/fastify fastify
# or
pnpm add @saga-bus/fastify fastify
```

## Features

- **Plugin Registration**: Register bus as a Fastify plugin
- **Request Decoration**: Access bus via `request.bus`
- **Correlation ID**: Automatic extraction and generation
- **Lifecycle Hooks**: Auto-start/stop bus with Fastify
- **Health Check**: Built-in health check route
- **Error Handler**: Saga-specific error handling

## Quick Start

```typescript
import Fastify from "fastify";
import { createBus } from "@saga-bus/core";
import { sagaBusFastifyPlugin } from "@saga-bus/fastify";

const bus = createBus({ /* config */ });

const app = Fastify({ logger: true });

// Register plugin
await app.register(sagaBusFastifyPlugin, {
  bus,
  healthCheck: true,
});

// Your routes
app.post("/orders", async (request, reply) => {
  await request.bus.publish({
    type: "CreateOrder",
    payload: request.body,
  });
  return { correlationId: request.correlationId };
});

await app.listen({ port: 3000 });
```

## API Reference

### sagaBusFastifyPlugin

Fastify plugin that integrates saga-bus.

```typescript
interface SagaBusFastifyOptions {
  /** The bus instance to register */
  bus: Bus;

  /** Whether to start bus when Fastify starts (default: true) */
  autoStart?: boolean;

  /** Whether to stop bus when Fastify closes (default: true) */
  autoStop?: boolean;

  /** Header name for correlation ID (default: "x-correlation-id") */
  correlationIdHeader?: string;

  /** Whether to generate correlation ID if not present (default: true) */
  generateCorrelationId?: boolean;

  /** Custom correlation ID generator */
  correlationIdGenerator?: () => string;

  /** Enable health check route */
  healthCheck?: boolean | HealthCheckConfig;
}

interface HealthCheckConfig {
  /** Route path for health check (default: "/health") */
  path?: string;

  /** Additional health checks */
  checks?: Array<{
    name: string;
    check: () => Promise<boolean>;
  }>;
}
```

## Examples

### Basic Usage

```typescript
import Fastify from "fastify";
import { createBus } from "@saga-bus/core";
import { sagaBusFastifyPlugin } from "@saga-bus/fastify";

const bus = createBus({ /* config */ });
const app = Fastify();

await app.register(sagaBusFastifyPlugin, { bus });

app.post("/messages", async (request) => {
  await request.bus.publish({
    type: request.body.type,
    payload: request.body.payload,
  });
  return { success: true, correlationId: request.correlationId };
});

await app.listen({ port: 3000 });
```

### With Health Check

```typescript
await app.register(sagaBusFastifyPlugin, {
  bus,
  healthCheck: {
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
  },
});
```

Health check response:

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

### Custom Correlation ID

```typescript
await app.register(sagaBusFastifyPlugin, {
  bus,
  correlationIdHeader: "x-request-id",
  correlationIdGenerator: () => `req-${Date.now()}-${Math.random().toString(36).slice(2)}`,
});
```

### Manual Lifecycle Control

```typescript
await app.register(sagaBusFastifyPlugin, {
  bus,
  autoStart: false,
  autoStop: false,
});

// Start bus manually
await bus.start();

// Stop bus manually before close
app.addHook("onClose", async () => {
  await bus.stop();
});
```

## TypeScript Support

The plugin extends Fastify types:

```typescript
// In your route handlers
app.get("/", async (request, reply) => {
  // request.bus is typed as Bus
  await request.bus.publish(message);

  // request.correlationId is typed as string
  console.log(`Processing ${request.correlationId}`);

  // fastify.bus is also available
  await request.server.bus.publish(message);
});
```

## Error Handling

The plugin installs a custom error handler for saga-specific errors:

- **SagaTimeoutError**: Returns 408 Request Timeout
- **ConcurrencyError**: Returns 409 Conflict

```typescript
app.get("/order/:id", async (request) => {
  // If this throws a ConcurrencyError, client gets 409
  await request.bus.publish({ type: "UpdateOrder", payload: { id: request.params.id } });
});
```

Response on ConcurrencyError:

```json
{
  "error": "Concurrency Conflict",
  "message": "Expected version 1, but found 2",
  "correlationId": "abc-123"
}
```

## Example: Complete Application

```typescript
import Fastify from "fastify";
import { createBus, InMemoryTransport, InMemorySagaStore } from "@saga-bus/core";
import { sagaBusFastifyPlugin } from "@saga-bus/fastify";

// Create bus
const bus = createBus({
  transport: new InMemoryTransport(),
  store: new InMemorySagaStore(),
});

// Create Fastify app
const app = Fastify({ logger: true });

// Register saga-bus plugin
await app.register(sagaBusFastifyPlugin, {
  bus,
  healthCheck: true,
});

// Routes
app.post("/orders", async (request) => {
  await request.bus.publish({
    type: "CreateOrder",
    payload: request.body,
  });
  return { orderId: "new-order", correlationId: request.correlationId };
});

app.get("/orders/:id", async (request) => {
  // Access bus from request
  const state = await request.bus.getSagaState("OrderSaga", request.params.id);
  return state;
});

// Start server
await app.listen({ port: 3000 });
console.log("Server running on port 3000");
```

## License

MIT
