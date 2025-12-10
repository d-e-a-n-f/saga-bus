# @saga-bus/middleware-logging

Structured logging middleware for saga-bus.

## Installation

```bash
pnpm add @saga-bus/middleware-logging
```

## Usage

```typescript
import { createLoggingMiddleware } from "@saga-bus/middleware-logging";
import { createBus } from "@saga-bus/core";

const loggingMiddleware = createLoggingMiddleware({
  logger: console,
  level: "info",
});

const bus = createBus({
  middleware: [loggingMiddleware],
  sagas: [...],
  transport,
});
```

## Log Events

| Event | Level | Description |
|-------|-------|-------------|
| `saga.message.received` | info | Message received for processing |
| `saga.handler.start` | debug | Handler execution started |
| `saga.handler.success` | info | Handler completed successfully |
| `saga.handler.error` | error | Handler threw an error |
| `saga.state.created` | info | New saga instance created |
| `saga.state.completed` | info | Saga marked as complete |

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logger` | `Logger` | `console` | Logger instance |
| `level` | `string` | `"info"` | Minimum log level |
| `includeState` | `boolean` | `false` | Include state in logs |

## License

MIT
