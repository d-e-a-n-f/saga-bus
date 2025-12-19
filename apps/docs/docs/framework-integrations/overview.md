---
sidebar_position: 1
---

# Framework Integrations

First-class support for popular frameworks.

## Available Integrations

| Framework | Package | Features |
|-----------|---------|----------|
| [NestJS](/docs/framework-integrations/nestjs) | `@saga-bus/nestjs` | Full DI, decorators |
| [Next.js](/docs/framework-integrations/nextjs) | `@saga-bus/nextjs` | App Router, API routes |
| [Express](/docs/framework-integrations/express) | `@saga-bus/express` | Middleware, health |
| [Fastify](/docs/framework-integrations/fastify) | `@saga-bus/fastify` | Plugin, health |
| [Hono](/docs/framework-integrations/hono) | `@saga-bus/hono` | Edge runtime |

## Choosing an Integration

### NestJS

Best for enterprise applications with full dependency injection:

```typescript
@Module({
  imports: [SagaBusModule.forRoot({ ... })],
})
export class AppModule {}
```

### Next.js

Best for serverless and edge deployments:

```typescript
// app/api/orders/route.ts
import { publishMessage } from '@saga-bus/nextjs';

export async function POST(request: Request) {
  await publishMessage({ type: 'OrderSubmitted', ... });
}
```

### Express/Fastify/Hono

Best for traditional Node.js servers:

```typescript
import { sagaBusMiddleware } from '@saga-bus/express';

app.use(sagaBusMiddleware({ bus }));
```

## Common Patterns

### Health Checks

All integrations support health endpoints:

```typescript
// Express
app.use('/health', createHealthRouter(bus));

// Fastify
fastify.register(sagaBusFastifyPlugin, { bus });

// NestJS
@Module({
  imports: [SagaBusModule.forRoot({ healthCheck: true })],
})
```

### Graceful Shutdown

```typescript
import { setupGracefulShutdown } from '@saga-bus/express';

setupGracefulShutdown(bus, server);
```
