---
sidebar_position: 2
title: Logging
---

# Logging Middleware

Structured logging for message processing with multiple output formats.

## Installation

```bash npm2yarn
npm install @saga-bus/middleware-logging
```

## Basic Usage

```typescript
import { createLoggingMiddleware } from '@saga-bus/middleware-logging';

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
  middleware: [
    createLoggingMiddleware({
      level: 'info',
    }),
  ],
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | `string` | `'info'` | Log level (debug, info, warn, error) |
| `logger` | `Logger` | console | Custom logger instance |
| `format` | `string` | `'json'` | Output format (json, pretty) |
| `includePayload` | `boolean` | `false` | Include message payload |
| `redactPaths` | `string[]` | `[]` | Paths to redact from logs |
| `onLog` | `function` | - | Custom log handler |

## Full Configuration Example

```typescript
import { createLoggingMiddleware } from '@saga-bus/middleware-logging';
import pino from 'pino';

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
  },
});

const loggingMiddleware = createLoggingMiddleware({
  level: 'info',
  logger,
  format: 'json',
  includePayload: true,
  redactPaths: ['password', 'creditCard', 'ssn'],
});
```

## Log Output

### Message Received

```json
{
  "level": "info",
  "time": "2024-01-15T10:30:00.000Z",
  "event": "message.received",
  "sagaName": "OrderSaga",
  "messageType": "OrderSubmitted",
  "correlationId": "order-123",
  "messageId": "msg-456"
}
```

### Message Processed

```json
{
  "level": "info",
  "time": "2024-01-15T10:30:00.100Z",
  "event": "message.processed",
  "sagaName": "OrderSaga",
  "messageType": "OrderSubmitted",
  "correlationId": "order-123",
  "duration": 100,
  "success": true
}
```

### Message Failed

```json
{
  "level": "error",
  "time": "2024-01-15T10:30:00.200Z",
  "event": "message.failed",
  "sagaName": "OrderSaga",
  "messageType": "OrderSubmitted",
  "correlationId": "order-123",
  "error": "PaymentDeclined",
  "stack": "..."
}
```

## Custom Logger Integration

### Pino

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

const middleware = createLoggingMiddleware({
  logger: {
    debug: (msg, data) => logger.debug(data, msg),
    info: (msg, data) => logger.info(data, msg),
    warn: (msg, data) => logger.warn(data, msg),
    error: (msg, data) => logger.error(data, msg),
  },
});
```

### Winston

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

const middleware = createLoggingMiddleware({
  logger: {
    debug: (msg, data) => logger.debug(msg, data),
    info: (msg, data) => logger.info(msg, data),
    warn: (msg, data) => logger.warn(msg, data),
    error: (msg, data) => logger.error(msg, data),
  },
});
```

## Sensitive Data Redaction

Automatically redact sensitive fields:

```typescript
const middleware = createLoggingMiddleware({
  includePayload: true,
  redactPaths: [
    'password',
    'creditCard.number',
    'creditCard.cvv',
    'user.ssn',
    'headers.authorization',
  ],
});

// Input
{
  "orderId": "123",
  "creditCard": {
    "number": "4111111111111111",
    "cvv": "123"
  }
}

// Output (logged)
{
  "orderId": "123",
  "creditCard": {
    "number": "[REDACTED]",
    "cvv": "[REDACTED]"
  }
}
```

## Conditional Logging

Log only certain message types:

```typescript
const middleware = createLoggingMiddleware({
  shouldLog: (context) => {
    // Skip health check messages
    if (context.messageType === 'HealthCheck') {
      return false;
    }
    return true;
  },
});
```

## Best Practices

### Use Structured Logging

```typescript
// Good - structured data
logger.info('Order processed', {
  orderId: '123',
  amount: 99.99,
  duration: 150,
});

// Avoid - string interpolation
logger.info(`Order ${orderId} processed for $${amount}`);
```

### Set Appropriate Log Levels

```typescript
// Production
createLoggingMiddleware({ level: 'info' });

// Development
createLoggingMiddleware({ level: 'debug' });
```

### Avoid Logging Sensitive Data

```typescript
createLoggingMiddleware({
  includePayload: false, // Default, safest option
  // Or use redaction
  redactPaths: ['password', 'token', 'creditCard'],
});
```

## See Also

- [Middleware Overview](/docs/middleware/overview)
- [Tracing Middleware](/docs/middleware/tracing)
- [Monitoring](/docs/production/monitoring)
