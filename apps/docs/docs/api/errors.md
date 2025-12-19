---
sidebar_position: 3
---

# Errors Reference

Error types and handling in saga-bus.

## Error Hierarchy

export const errorNodes = [
  { id: 'error', type: 'stateNode', position: { x: 200, y: 0 }, data: { label: 'Error', status: 'initial' } },
  { id: 'base', type: 'stateNode', position: { x: 200, y: 70 }, data: { label: 'SagaBusError', description: 'base class' } },
  { id: 'transient', type: 'stateNode', position: { x: 50, y: 150 }, data: { label: 'TransientError', description: 'retriable', status: 'warning' } },
  { id: 'permanent', type: 'stateNode', position: { x: 350, y: 150 }, data: { label: 'PermanentError', description: 'not retriable', status: 'error' } },
  { id: 'network', type: 'stateNode', position: { x: -50, y: 230 }, data: { label: 'NetworkError', status: 'warning' } },
  { id: 'timeout', type: 'stateNode', position: { x: 50, y: 230 }, data: { label: 'TimeoutError', status: 'warning' } },
  { id: 'ratelimit', type: 'stateNode', position: { x: 150, y: 230 }, data: { label: 'RateLimitError', status: 'warning' } },
  { id: 'validation', type: 'stateNode', position: { x: 270, y: 230 }, data: { label: 'ValidationError', status: 'error' } },
  { id: 'auth', type: 'stateNode', position: { x: 380, y: 230 }, data: { label: 'AuthorizationError', status: 'error' } },
  { id: 'business', type: 'stateNode', position: { x: 500, y: 230 }, data: { label: 'BusinessRuleError', status: 'error' } },
  { id: 'concurrency', type: 'stateNode', position: { x: 100, y: 320 }, data: { label: 'ConcurrencyError', status: 'active' } },
  { id: 'processing', type: 'stateNode', position: { x: 220, y: 320 }, data: { label: 'SagaProcessingError', status: 'active' } },
  { id: 'config', type: 'stateNode', position: { x: 340, y: 320 }, data: { label: 'ConfigurationError', status: 'error' } },
  { id: 'transport', type: 'stateNode', position: { x: 460, y: 320 }, data: { label: 'TransportError', status: 'active' } },
];

export const errorEdges = [
  { id: 'er1', source: 'error', target: 'base' },
  { id: 'er2', source: 'base', target: 'transient' },
  { id: 'er3', source: 'base', target: 'permanent' },
  { id: 'er4', source: 'transient', target: 'network' },
  { id: 'er5', source: 'transient', target: 'timeout' },
  { id: 'er6', source: 'transient', target: 'ratelimit' },
  { id: 'er7', source: 'permanent', target: 'validation' },
  { id: 'er8', source: 'permanent', target: 'auth' },
  { id: 'er9', source: 'permanent', target: 'business' },
  { id: 'er10', source: 'base', target: 'concurrency' },
  { id: 'er11', source: 'base', target: 'processing' },
  { id: 'er12', source: 'base', target: 'config' },
  { id: 'er13', source: 'base', target: 'transport' },
];

<FlowDiagram nodes={errorNodes} edges={errorEdges} height={420} />

## Base Error Classes

### `SagaBusError`

Base class for all saga-bus errors.

```typescript
import { SagaBusError } from '@saga-bus/core';

class SagaBusError extends Error {
  // Unique error code
  readonly code: string;

  // Whether this error is retriable
  readonly retryable: boolean;

  // Additional context
  readonly context?: Record<string, any>;

  constructor(message: string, options?: SagaBusErrorOptions);
}

interface SagaBusErrorOptions {
  code?: string;
  retryable?: boolean;
  context?: Record<string, any>;
  cause?: Error;
}
```

**Usage:**

```typescript
throw new SagaBusError('Something went wrong', {
  code: 'CUSTOM_ERROR',
  retryable: false,
  context: { orderId: '123' },
});
```

---

## Transient Errors

Transient errors are automatically retried according to the retry policy.

### `TransientError`

Base class for retriable errors.

```typescript
import { TransientError } from '@saga-bus/core';

class TransientError extends SagaBusError {
  readonly retryable = true;
}

// Usage
throw new TransientError('Service temporarily unavailable');
```

### `NetworkError`

Network-related failures.

```typescript
import { NetworkError } from '@saga-bus/core';

class NetworkError extends TransientError {
  readonly code = 'NETWORK_ERROR';
}

// Thrown automatically on connection failures
// Can also be thrown manually:
throw new NetworkError('Connection refused');
```

### `TimeoutError`

Operation timeout.

```typescript
import { TimeoutError } from '@saga-bus/core';

class TimeoutError extends TransientError {
  readonly code = 'TIMEOUT_ERROR';

  // Time waited before timeout (ms)
  readonly timeout: number;
}

throw new TimeoutError('Operation timed out', { timeout: 30000 });
```

### `RateLimitError`

Rate limit exceeded.

```typescript
import { RateLimitError } from '@saga-bus/core';

class RateLimitError extends TransientError {
  readonly code = 'RATE_LIMIT_ERROR';

  // When to retry (ms from now)
  readonly retryAfter: number;
}

throw new RateLimitError('Too many requests', { retryAfter: 60000 });
```

---

## Permanent Errors

Permanent errors are not retried and typically sent to a dead letter queue.

### `PermanentError`

Base class for non-retriable errors.

```typescript
import { PermanentError } from '@saga-bus/core';

class PermanentError extends SagaBusError {
  readonly retryable = false;
}
```

### `ValidationError`

Input validation failure.

```typescript
import { ValidationError } from '@saga-bus/core';

class ValidationError extends PermanentError {
  readonly code = 'VALIDATION_ERROR';

  // Validation errors by field
  readonly errors?: Record<string, string[]>;
}

throw new ValidationError('Invalid input', {
  errors: {
    orderId: ['orderId is required'],
    total: ['total must be positive'],
  },
});
```

### `AuthorizationError`

Authorization/permission failure.

```typescript
import { AuthorizationError } from '@saga-bus/core';

class AuthorizationError extends PermanentError {
  readonly code = 'AUTHORIZATION_ERROR';

  // Required permission
  readonly requiredPermission?: string;
}

throw new AuthorizationError('Access denied', {
  requiredPermission: 'orders:create',
});
```

### `BusinessRuleError`

Business logic violation.

```typescript
import { BusinessRuleError } from '@saga-bus/core';

class BusinessRuleError extends PermanentError {
  readonly code = 'BUSINESS_RULE_ERROR';

  // Rule that was violated
  readonly rule?: string;
}

throw new BusinessRuleError('Cannot cancel shipped order', {
  rule: 'order_cancellation_policy',
});
```

---

## System Errors

### `ConcurrencyError`

Optimistic concurrency conflict.

```typescript
import { ConcurrencyError } from '@saga-bus/core';

class ConcurrencyError extends SagaBusError {
  readonly code = 'CONCURRENCY_ERROR';
  readonly retryable = true;

  // Expected version
  readonly expectedVersion: number;

  // Actual version
  readonly actualVersion: number;
}

// Thrown by stores when version mismatch
// Automatically retried by saga-bus
```

**Handling:**

```typescript
try {
  await store.update(sagaName, correlationId, state, version);
} catch (error) {
  if (error instanceof ConcurrencyError) {
    // Another process updated the saga - reload and retry
    const current = await store.getByCorrelationId(sagaName, correlationId);
    // Re-process with current state
  }
}
```

### `SagaProcessingError`

Error during saga handler execution.

```typescript
import { SagaProcessingError } from '@saga-bus/core';

class SagaProcessingError extends SagaBusError {
  readonly code = 'SAGA_PROCESSING_ERROR';

  // Original error
  readonly cause: Error;

  // Saga information
  readonly sagaName: string;
  readonly correlationId: string;
  readonly messageType: string;
}
```

### `ConfigurationError`

Invalid configuration.

```typescript
import { ConfigurationError } from '@saga-bus/core';

class ConfigurationError extends SagaBusError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly retryable = false;
}

throw new ConfigurationError('Missing required transport configuration');
```

### `TransportError`

Transport-level error.

```typescript
import { TransportError } from '@saga-bus/core';

class TransportError extends SagaBusError {
  readonly code = 'TRANSPORT_ERROR';

  // Transport name
  readonly transport: string;
}
```

---

## Error Handling

### Custom Error Handler

```typescript
import { createBus, createErrorHandler } from '@saga-bus/core';

const errorHandler = createErrorHandler({
  onTransientError: async (error, envelope) => {
    logger.warn('Transient error, will retry', {
      error: error.message,
      messageType: envelope.message.type,
      attempt: envelope.retryInfo.attempt,
    });
  },

  onPermanentError: async (error, envelope) => {
    logger.error('Permanent error, sending to DLQ', {
      error: error.message,
      messageType: envelope.message.type,
    });

    await alertService.notify({
      severity: 'error',
      title: 'Message processing failed',
      details: { error, message: envelope.message },
    });
  },
});

const bus = createBus({
  transport,
  store,
  sagas,
  errorHandler,
});
```

### Error Classification Middleware

```typescript
const errorClassifier = createMiddleware({
  name: 'error-classifier',
  onError: async ({ error }) => {
    // Classify unknown errors
    if (error.code === 'ECONNREFUSED') {
      throw new NetworkError(error.message);
    }

    if (error.code === 'ETIMEDOUT') {
      throw new TimeoutError(error.message);
    }

    if (error.response?.status === 429) {
      throw new RateLimitError('Rate limited', {
        retryAfter: error.response.headers['retry-after'] * 1000,
      });
    }

    if (error.response?.status === 400) {
      throw new ValidationError(error.message);
    }

    if (error.response?.status === 403) {
      throw new AuthorizationError(error.message);
    }

    // Re-throw unclassified errors
    throw error;
  },
});
```

### Try-Catch in Handlers

```typescript
const orderSaga = defineSaga({
  handlers: {
    ProcessPayment: async (ctx) => {
      try {
        const result = await paymentService.capture(ctx.message);

        ctx.setState({
          ...ctx.state,
          status: 'paid',
          transactionId: result.transactionId,
        });
      } catch (error) {
        if (error instanceof PaymentDeclinedError) {
          // Business error - mark as failed, don't retry
          ctx.setState({
            ...ctx.state,
            status: 'payment_declined',
            failureReason: error.message,
          });
          return;
        }

        // Re-throw for retry
        throw error;
      }
    },
  },
});
```

---

## Creating Custom Errors

```typescript
import { SagaBusError } from '@saga-bus/core';

// Transient custom error
class ExternalServiceError extends SagaBusError {
  constructor(service: string, message: string) {
    super(message, {
      code: 'EXTERNAL_SERVICE_ERROR',
      retryable: true,
      context: { service },
    });
  }
}

// Permanent custom error
class InsufficientFundsError extends SagaBusError {
  constructor(available: number, required: number) {
    super(`Insufficient funds: ${available} < ${required}`, {
      code: 'INSUFFICIENT_FUNDS',
      retryable: false,
      context: { available, required },
    });
  }
}

// Usage
throw new ExternalServiceError('payment-gateway', 'Gateway timeout');
throw new InsufficientFundsError(50, 100);
```

---

## Error Codes Reference

| Code | Error Class | Retriable | Description |
|------|-------------|-----------|-------------|
| `NETWORK_ERROR` | `NetworkError` | Yes | Network connectivity issue |
| `TIMEOUT_ERROR` | `TimeoutError` | Yes | Operation timed out |
| `RATE_LIMIT_ERROR` | `RateLimitError` | Yes | Rate limit exceeded |
| `VALIDATION_ERROR` | `ValidationError` | No | Input validation failed |
| `AUTHORIZATION_ERROR` | `AuthorizationError` | No | Permission denied |
| `BUSINESS_RULE_ERROR` | `BusinessRuleError` | No | Business logic violation |
| `CONCURRENCY_ERROR` | `ConcurrencyError` | Yes | Optimistic locking conflict |
| `SAGA_PROCESSING_ERROR` | `SagaProcessingError` | Varies | Handler execution failed |
| `CONFIGURATION_ERROR` | `ConfigurationError` | No | Invalid configuration |
| `TRANSPORT_ERROR` | `TransportError` | Varies | Transport-level failure |

---

## Best Practices

1. **Classify errors correctly** - Use appropriate error types for proper retry behavior
2. **Include context** - Add relevant information to error context
3. **Preserve error chains** - Use `cause` option to preserve original errors
4. **Log at boundaries** - Log errors at the middleware level
5. **Alert on permanent errors** - These require manual attention
6. **Monitor retry rates** - High retry rates indicate systemic issues

## See Also

- [Core API Reference](/docs/api/core)
- [Types Reference](/docs/api/types)
- [Error Recovery](/docs/production/error-recovery)
