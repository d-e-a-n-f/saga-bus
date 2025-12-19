---
sidebar_position: 5
title: Error Recovery
---

# Error Recovery

Handle failures gracefully with dead letter queues, retries, and manual intervention tools.

## Retry Strategies

### Exponential Backoff

```typescript
const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
  retry: {
    maxAttempts: 5,
    initialDelay: 1000,      // 1 second
    maxDelay: 60000,         // 1 minute max
    backoffMultiplier: 2,    // Double each time
    jitter: true,            // Add randomness
  },
});

// Retry delays: 1s, 2s, 4s, 8s, 16s (capped at 60s)
```

### Per-Message Type Retries

```typescript
const orderSaga = defineSaga({
  name: 'OrderSaga',
  handlers: {
    PaymentFailed: {
      handler: handlePaymentFailed,
      retry: {
        maxAttempts: 3,
        retryOn: [TransientError, NetworkError],
        noRetryOn: [ValidationError, BusinessError],
      },
    },
  },
});
```

### Custom Retry Logic

```typescript
const customRetry = createMiddleware({
  name: 'custom-retry',
  onError: async ({ error, message, context, retry }) => {
    if (error instanceof RateLimitError) {
      // Wait for rate limit reset
      await sleep(error.retryAfter);
      return retry();
    }

    if (error instanceof TransientError && context.retryCount < 3) {
      return retry({ delay: 1000 * Math.pow(2, context.retryCount) });
    }

    // Don't retry other errors
    throw error;
  },
});
```

## Dead Letter Queues

### Configuration

```typescript
const transport = new RabbitMQTransport({
  url: 'amqp://localhost',
  queue: 'saga-messages',
  deadLetterQueue: 'saga-messages-dlq',
  deadLetterExchange: 'dlx',
  maxRetries: 5,
});
```

### DLQ Message Structure

```typescript
interface DeadLetterMessage {
  originalMessage: Message;
  error: {
    message: string;
    stack: string;
    code?: string;
  };
  metadata: {
    sagaName: string;
    correlationId: string;
    retryCount: number;
    firstFailedAt: string;
    lastFailedAt: string;
    failureReason: string;
  };
}
```

### Processing DLQ Messages

```typescript
import { createDLQProcessor } from '@saga-bus/core';

const dlqProcessor = createDLQProcessor({
  transport,
  store,
  onMessage: async (dlqMessage) => {
    // Log for investigation
    logger.error('DLQ message received', {
      type: dlqMessage.originalMessage.type,
      correlationId: dlqMessage.metadata.correlationId,
      error: dlqMessage.error.message,
      retryCount: dlqMessage.metadata.retryCount,
    });

    // Notify operations team
    await alerting.notify({
      severity: 'warning',
      title: 'Message sent to DLQ',
      details: dlqMessage,
    });
  },
});

await dlqProcessor.start();
```

## Saga Recovery

### Stuck Saga Detection

```typescript
import { createSagaRecovery } from '@saga-bus/core';

const recovery = createSagaRecovery({
  store,
  transport,
  stuckThreshold: 30 * 60 * 1000, // 30 minutes
  checkInterval: 5 * 60 * 1000,   // Check every 5 minutes
});

recovery.onStuckSaga(async (saga) => {
  logger.warn('Stuck saga detected', {
    sagaName: saga.name,
    correlationId: saga.correlationId,
    status: saga.state.status,
    lastUpdated: saga.updatedAt,
  });

  // Attempt recovery
  await recovery.retry(saga);
});

await recovery.start();
```

### Manual Saga Operations

```typescript
// Get saga state
const saga = await store.getByCorrelationId('OrderSaga', 'order-123');

// Manually update state
await store.update('OrderSaga', 'order-123', {
  ...saga.state,
  status: 'cancelled',
  cancelReason: 'Manual intervention',
  cancelledAt: new Date().toISOString(),
});

// Replay a message
await bus.publish({
  type: 'OrderCancelled',
  orderId: 'order-123',
  reason: 'Manual cancellation',
});

// Mark saga as completed
await store.complete('OrderSaga', 'order-123');
```

### Recovery CLI

```typescript
// recovery-cli.ts
import { Command } from 'commander';

const program = new Command();

program
  .command('list-stuck')
  .option('--threshold <minutes>', 'Stuck threshold', '30')
  .action(async (options) => {
    const stuckSagas = await store.findStuck({
      threshold: parseInt(options.threshold) * 60 * 1000,
    });

    console.table(stuckSagas.map(s => ({
      name: s.name,
      correlationId: s.correlationId,
      status: s.state.status,
      lastUpdated: s.updatedAt,
    })));
  });

program
  .command('retry <sagaName> <correlationId>')
  .action(async (sagaName, correlationId) => {
    const saga = await store.getByCorrelationId(sagaName, correlationId);

    if (!saga) {
      console.error('Saga not found');
      return;
    }

    // Re-publish last message
    await bus.publish(saga.lastMessage);
    console.log('Message replayed');
  });

program
  .command('cancel <sagaName> <correlationId>')
  .option('--reason <reason>', 'Cancellation reason')
  .action(async (sagaName, correlationId, options) => {
    await store.update(sagaName, correlationId, {
      status: 'cancelled',
      cancelReason: options.reason || 'Manual cancellation',
    });

    await store.complete(sagaName, correlationId);
    console.log('Saga cancelled');
  });

program.parse();
```

## Compensation Handling

### Automatic Compensation

```typescript
const orderSaga = defineSaga({
  name: 'OrderSaga',
  handlers: {
    InventoryFailed: async (ctx) => {
      // Inventory reservation failed after payment
      if (ctx.state.transactionId) {
        // Compensate: refund payment
        ctx.publish({
          type: 'RefundRequested',
          orderId: ctx.state.orderId,
          transactionId: ctx.state.transactionId,
          reason: 'Inventory unavailable',
        });

        ctx.setState({
          ...ctx.state,
          status: 'compensating',
        });
      }
    },

    RefundCompleted: async (ctx) => {
      ctx.setState({
        ...ctx.state,
        status: 'cancelled',
        refundedAt: new Date().toISOString(),
      });
      ctx.complete();
    },
  },
});
```

### Compensation Tracking

```typescript
interface SagaState {
  orderId: string;
  status: string;
  compensationSteps: CompensationStep[];
}

interface CompensationStep {
  action: string;
  status: 'pending' | 'completed' | 'failed';
  completedAt?: string;
  error?: string;
}

const handlers = {
  PaymentCaptured: async (ctx) => {
    ctx.setState({
      ...ctx.state,
      transactionId: ctx.message.transactionId,
      compensationSteps: [
        ...ctx.state.compensationSteps,
        { action: 'refund_payment', status: 'pending' },
      ],
    });
  },

  // During compensation
  RefundCompleted: async (ctx) => {
    const steps = ctx.state.compensationSteps.map(step =>
      step.action === 'refund_payment'
        ? { ...step, status: 'completed', completedAt: new Date().toISOString() }
        : step
    );

    ctx.setState({
      ...ctx.state,
      compensationSteps: steps,
    });
  },
};
```

## Error Classification

### Error Types

```typescript
// Transient errors - can retry
class TransientError extends Error {
  readonly retryable = true;
}

class NetworkError extends TransientError {}
class TimeoutError extends TransientError {}
class RateLimitError extends TransientError {
  constructor(public retryAfter: number) {
    super('Rate limited');
  }
}

// Permanent errors - don't retry
class PermanentError extends Error {
  readonly retryable = false;
}

class ValidationError extends PermanentError {}
class BusinessRuleError extends PermanentError {}
class AuthorizationError extends PermanentError {}
```

### Error Handler Middleware

```typescript
const errorClassifier = createMiddleware({
  name: 'error-classifier',
  onError: async ({ error, context }) => {
    // Classify unknown errors
    if (error.code === 'ECONNREFUSED') {
      throw new NetworkError(error.message);
    }

    if (error.code === 'ETIMEDOUT') {
      throw new TimeoutError(error.message);
    }

    if (error.response?.status === 429) {
      throw new RateLimitError(error.response.headers['retry-after']);
    }

    if (error.response?.status === 400) {
      throw new ValidationError(error.message);
    }

    // Re-throw original if not classified
    throw error;
  },
});
```

## Circuit Breaker

```typescript
import CircuitBreaker from 'opossum';

const paymentBreaker = new CircuitBreaker(paymentService.capture, {
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});

paymentBreaker.on('open', () => {
  logger.warn('Payment circuit breaker opened');
});

paymentBreaker.on('halfOpen', () => {
  logger.info('Payment circuit breaker half-open');
});

paymentBreaker.on('close', () => {
  logger.info('Payment circuit breaker closed');
});

// Use in handler
async function handlePaymentRequest(ctx) {
  try {
    const result = await paymentBreaker.fire({
      orderId: ctx.state.orderId,
      amount: ctx.message.amount,
    });
    // ...
  } catch (error) {
    if (error.message === 'Breaker is open') {
      // Queue for later retry
      ctx.publish({
        type: 'PaymentDeferred',
        orderId: ctx.state.orderId,
        retryAt: Date.now() + 60000,
      });
    }
    throw error;
  }
}
```

## Monitoring Recovery

### Metrics

```typescript
const recoveryMetrics = {
  retryAttempts: new Counter({
    name: 'saga_bus_retry_attempts_total',
    help: 'Total retry attempts',
    labelNames: ['saga_name', 'message_type'],
  }),

  dlqMessages: new Counter({
    name: 'saga_bus_dlq_messages_total',
    help: 'Messages sent to DLQ',
    labelNames: ['saga_name', 'error_type'],
  }),

  stuckSagas: new Gauge({
    name: 'saga_bus_stuck_sagas',
    help: 'Number of stuck sagas',
    labelNames: ['saga_name'],
  }),

  recoveryOperations: new Counter({
    name: 'saga_bus_recovery_operations_total',
    help: 'Manual recovery operations',
    labelNames: ['operation', 'saga_name'],
  }),
};
```

### Alerts

```yaml
groups:
  - name: recovery-alerts
    rules:
      - alert: HighDLQRate
        expr: rate(saga_bus_dlq_messages_total[5m]) > 1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High rate of messages going to DLQ"

      - alert: StuckSagas
        expr: saga_bus_stuck_sagas > 10
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Multiple stuck sagas detected"

      - alert: HighRetryRate
        expr: |
          rate(saga_bus_retry_attempts_total[5m]) /
          rate(saga_bus_messages_processed_total[5m]) > 0.1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High retry rate indicates system instability"
```

## Best Practices

1. **Classify errors properly** - Distinguish transient from permanent failures
2. **Use exponential backoff** - Prevent thundering herd
3. **Set retry limits** - Avoid infinite loops
4. **Monitor DLQ depth** - Alert on growing backlog
5. **Document recovery procedures** - Runbooks for common issues
6. **Test failure scenarios** - Chaos engineering
7. **Keep compensation idempotent** - Safe to retry

## See Also

- [Deployment](/docs/production/deployment)
- [Health Checks](/docs/production/health-checks)
- [Security](/docs/production/security)
