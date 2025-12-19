---
sidebar_position: 8
title: Custom Middleware
---

# Custom Middleware

Create your own middleware for cross-cutting concerns.

## Middleware Interface

```typescript
interface SagaMiddleware {
  name: string;
  execute(
    context: SagaPipelineContext,
    next: () => Promise<void>
  ): Promise<void>;
}
```

## Basic Example

```typescript
const timingMiddleware: SagaMiddleware = {
  name: 'timing',
  async execute(context, next) {
    const start = Date.now();

    await next(); // Call next middleware/handler

    const duration = Date.now() - start;
    console.log(`${context.messageType} took ${duration}ms`);
  },
};

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
  middleware: [timingMiddleware],
});
```

## Pipeline Context

The context object contains:

```typescript
interface SagaPipelineContext {
  // Message info
  messageId: string;
  messageType: string;
  message: unknown;
  headers: Record<string, string>;

  // Saga info
  sagaName: string;
  sagaId: string | null;
  correlationId: string;

  // State
  sagaState: SagaState | null;

  // Services
  store: SagaStore;
  transport: Transport;

  // Utilities
  publish<T>(message: T, options?: PublishOptions): Promise<void>;

  // Custom data
  metadata: Map<string, unknown>;
}
```

## Common Patterns

### Before/After Processing

```typescript
const auditMiddleware: SagaMiddleware = {
  name: 'audit',
  async execute(context, next) {
    // Before processing
    await auditLog.record({
      event: 'message.received',
      messageId: context.messageId,
      timestamp: new Date(),
    });

    try {
      await next();

      // After successful processing
      await auditLog.record({
        event: 'message.processed',
        messageId: context.messageId,
        timestamp: new Date(),
      });
    } catch (error) {
      // After failed processing
      await auditLog.record({
        event: 'message.failed',
        messageId: context.messageId,
        error: error.message,
        timestamp: new Date(),
      });
      throw error;
    }
  },
};
```

### Error Handling

```typescript
const retryMiddleware: SagaMiddleware = {
  name: 'retry',
  async execute(context, next) {
    const maxRetries = 3;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await next();
        return; // Success
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 100;
          await sleep(delay);
        }
      }
    }

    throw lastError;
  },
};
```

### Context Enrichment

```typescript
const contextMiddleware: SagaMiddleware = {
  name: 'context',
  async execute(context, next) {
    // Add data to context
    context.metadata.set('requestId', generateRequestId());
    context.metadata.set('startTime', Date.now());

    await next();
  },
};

// Access in handlers
const orderSaga = defineSaga<OrderState>({
  name: 'OrderSaga',
})
  .handle('OrderSubmitted', async (context) => {
    const requestId = context.metadata.get('requestId');
    // ...
  });
```

### Conditional Processing

```typescript
const maintenanceMiddleware: SagaMiddleware = {
  name: 'maintenance',
  async execute(context, next) {
    if (await isMaintenanceMode()) {
      console.log('Maintenance mode - message queued');
      await requeue(context);
      return; // Don't call next()
    }

    await next();
  },
};
```

### Rate Limiting

```typescript
import Bottleneck from 'bottleneck';

const limiter = new Bottleneck({
  maxConcurrent: 10,
  minTime: 100,
});

const rateLimitMiddleware: SagaMiddleware = {
  name: 'rate-limit',
  async execute(context, next) {
    await limiter.schedule(() => next());
  },
};
```

### Circuit Breaker

```typescript
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(
  async (next: () => Promise<void>) => next(),
  {
    timeout: 30000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
  }
);

const circuitBreakerMiddleware: SagaMiddleware = {
  name: 'circuit-breaker',
  async execute(context, next) {
    await breaker.fire(next);
  },
};
```

## Creating Configurable Middleware

### Factory Pattern

```typescript
interface CacheMiddlewareOptions {
  ttl: number;
  keyPrefix: string;
  cache: Cache;
}

function createCacheMiddleware(options: CacheMiddlewareOptions): SagaMiddleware {
  const { ttl, keyPrefix, cache } = options;

  return {
    name: 'cache',
    async execute(context, next) {
      const key = `${keyPrefix}:${context.messageId}`;

      // Check cache
      const cached = await cache.get(key);
      if (cached) {
        context.metadata.set('cached', true);
        return;
      }

      await next();

      // Store in cache
      await cache.set(key, true, ttl);
    },
  };
}

// Usage
const bus = createBus({
  middleware: [
    createCacheMiddleware({
      ttl: 3600,
      keyPrefix: 'saga',
      cache: redisCache,
    }),
  ],
});
```

### Class-Based

```typescript
class SecurityMiddleware implements SagaMiddleware {
  name = 'security';

  constructor(
    private readonly authService: AuthService,
    private readonly permissionService: PermissionService
  ) {}

  async execute(context: SagaPipelineContext, next: () => Promise<void>) {
    const token = context.headers['authorization'];

    // Verify token
    const user = await this.authService.verify(token);
    context.metadata.set('user', user);

    // Check permissions
    const allowed = await this.permissionService.check(
      user,
      context.messageType
    );

    if (!allowed) {
      throw new ForbiddenError();
    }

    await next();
  }
}

// Usage
const bus = createBus({
  middleware: [
    new SecurityMiddleware(authService, permissionService),
  ],
});
```

## Testing Middleware

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('TimingMiddleware', () => {
  it('measures execution time', async () => {
    const consoleSpy = vi.spyOn(console, 'log');

    const context = createMockContext({
      messageType: 'OrderSubmitted',
    });

    const next = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    await timingMiddleware.execute(context, next);

    expect(next).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/OrderSubmitted took \d+ms/)
    );
  });
});

// Helper to create mock context
function createMockContext(overrides = {}): SagaPipelineContext {
  return {
    messageId: 'msg-123',
    messageType: 'TestMessage',
    message: {},
    headers: {},
    sagaName: 'TestSaga',
    sagaId: 'saga-456',
    correlationId: 'corr-789',
    sagaState: null,
    metadata: new Map(),
    publish: vi.fn(),
    ...overrides,
  };
}
```

## Best Practices

### Always Call Next (Unless Intentionally Stopping)

```typescript
// Good
async execute(context, next) {
  doSomething();
  await next(); // Always call
  doSomethingElse();
}

// Only skip next() intentionally
async execute(context, next) {
  if (shouldSkip(context)) {
    return; // Intentional - document why
  }
  await next();
}
```

### Handle Errors Appropriately

```typescript
async execute(context, next) {
  try {
    await next();
  } catch (error) {
    // Log, transform, or re-throw
    throw error; // Don't swallow errors silently
  }
}
```

### Use Meaningful Names

```typescript
// Good
{ name: 'authentication' }
{ name: 'rate-limiter' }
{ name: 'audit-logger' }

// Avoid
{ name: 'middleware1' }
{ name: 'handler' }
```

## See Also

- [Middleware Overview](/docs/middleware/overview)
- [Logging Middleware](/docs/middleware/logging)
- [Error Handling](/docs/core-concepts/error-handling)
