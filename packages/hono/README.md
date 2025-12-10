# @saga-bus/hono

Hono integration for saga-bus, designed for edge runtimes (Cloudflare Workers, Deno, Bun).

## Installation

```bash
npm install @saga-bus/hono hono
# or
pnpm add @saga-bus/hono hono
```

## Features

- **Edge Runtime Compatible**: Works with Cloudflare Workers, Deno, Bun
- **Context Variables**: Type-safe `c.var.bus` and `c.var.correlationId`
- **Health Handler**: Factory for health check routes
- **Error Handler**: Saga-specific error responses
- **No Node.js Dependencies**: Uses simple UUID generator

## Quick Start

```typescript
import { Hono } from "hono";
import { createBus } from "@saga-bus/core";
import {
  sagaBusMiddleware,
  sagaErrorHandler,
  createHealthHandler,
} from "@saga-bus/hono";

const bus = createBus({ /* config */ });
await bus.start();

const app = new Hono();

// Error handler first
app.use("*", sagaErrorHandler());

// Attach bus to context
app.use("*", sagaBusMiddleware({ bus }));

// Health check
app.get("/health", createHealthHandler({ bus }));

// Your routes
app.post("/orders", async (c) => {
  const bus = c.get("bus");
  const correlationId = c.get("correlationId");

  await bus.publish({
    type: "CreateOrder",
    payload: await c.req.json(),
  });

  return c.json({ correlationId });
});

export default app;
```

## API Reference

### sagaBusMiddleware(options)

Creates middleware that attaches the bus instance and correlation ID to context.

```typescript
interface SagaBusHonoOptions {
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

### sagaErrorHandler()

Error handler middleware for saga-related errors.

- **SagaTimeoutError**: Returns 408 Request Timeout
- **ConcurrencyError**: Returns 409 Conflict

### createHealthHandler(options)

Creates a health check handler.

```typescript
interface HealthCheckOptions {
  /** The bus instance to check */
  bus: Bus;

  /** Additional health checks */
  checks?: Array<{
    name: string;
    check: () => Promise<boolean>;
  }>;
}
```

### SagaBusEnv

Type definition for Hono context variables.

```typescript
interface SagaBusEnv extends Env {
  Variables: {
    bus: Bus;
    correlationId: string;
  };
}
```

## Examples

### Basic Usage

```typescript
import { Hono } from "hono";
import { sagaBusMiddleware, SagaBusEnv } from "@saga-bus/hono";

const app = new Hono<SagaBusEnv>();

app.use("*", sagaBusMiddleware({ bus }));

app.post("/messages", async (c) => {
  const bus = c.get("bus");
  const correlationId = c.get("correlationId");

  await bus.publish({
    type: c.req.query("type") || "Message",
    payload: await c.req.json(),
  });

  return c.json({ success: true, correlationId });
});
```

### With Health Checks

```typescript
import { createHealthHandler } from "@saga-bus/hono";

app.get("/health", createHealthHandler({
  bus,
  checks: [
    {
      name: "database",
      check: async () => {
        await db.query("SELECT 1");
        return true;
      },
    },
  ],
}));
```

### Cloudflare Workers

```typescript
import { Hono } from "hono";
import { sagaBusMiddleware, SagaBusEnv } from "@saga-bus/hono";
import { createBus } from "@saga-bus/core";

interface Env {
  DB: D1Database;
}

const app = new Hono<SagaBusEnv & { Bindings: Env }>();

// Create bus per-request from environment
app.use("*", async (c, next) => {
  const bus = createBusFromEnv(c.env);
  return sagaBusMiddleware({ bus })(c, next);
});

app.post("/messages", async (c) => {
  await c.get("bus").publish({ type: "Message", payload: {} });
  return c.json({ ok: true });
});

export default app;
```

### Deno

```typescript
import { Hono } from "https://deno.land/x/hono/mod.ts";
import { sagaBusMiddleware, SagaBusEnv } from "@saga-bus/hono";

const app = new Hono<SagaBusEnv>();
app.use("*", sagaBusMiddleware({ bus }));

Deno.serve(app.fetch);
```

### Custom Correlation ID Generator

```typescript
app.use("*", sagaBusMiddleware({
  bus,
  correlationIdHeader: "x-request-id",
  correlationIdGenerator: () => `req-${Date.now()}-${Math.random().toString(36).slice(2)}`,
}));
```

## TypeScript Support

The package provides full type safety for context variables:

```typescript
import { Hono } from "hono";
import { SagaBusEnv } from "@saga-bus/hono";

// Use SagaBusEnv for typed context
const app = new Hono<SagaBusEnv>();

app.get("/", (c) => {
  // c.get("bus") is typed as Bus
  const bus = c.get("bus");

  // c.get("correlationId") is typed as string
  const correlationId = c.get("correlationId");

  return c.json({ correlationId });
});
```

## Error Handling

```typescript
app.use("*", sagaErrorHandler());

app.get("/order/:id", async (c) => {
  // If this throws a ConcurrencyError, client gets 409
  await c.get("bus").publish({
    type: "UpdateOrder",
    payload: { id: c.req.param("id") },
  });
  return c.json({ updated: true });
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

## License

MIT
