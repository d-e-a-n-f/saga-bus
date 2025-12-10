# @saga-bus/middleware-tenant

Multi-tenant isolation middleware for saga-bus.

## Installation

```bash
pnpm add @saga-bus/middleware-tenant
```

## Usage

```typescript
import { createTenantMiddleware, getTenantId } from "@saga-bus/middleware-tenant";
import { createBus } from "@saga-bus/core";

const tenantMiddleware = createTenantMiddleware({
  strategy: "header",
  headerName: "x-tenant-id",
  required: true,
});

const bus = createBus({
  middleware: [tenantMiddleware],
  sagas: [...],
  transport,
});

// Access tenant in handlers
const tenantId = getTenantId(); // from AsyncLocalStorage context
```

## Tenant Resolution Strategies

### Header Strategy (default)
Extracts tenant ID from message headers:

```typescript
createTenantMiddleware({
  strategy: "header",
  headerName: "x-tenant-id",
});
```

### Correlation Prefix Strategy
Extracts tenant ID from correlation ID prefix:

```typescript
createTenantMiddleware({
  strategy: "correlation-prefix",
  correlationSeparator: ":",
});
// correlationId "tenant123:order-456" → tenantId "tenant123"
```

### Custom Strategy
Provide your own resolver function:

```typescript
createTenantMiddleware({
  strategy: "custom",
  resolver: (envelope) => envelope.payload?.tenantId,
});
```

## Tenant-Aware Publishing

```typescript
import { createTenantPublisher } from "@saga-bus/middleware-tenant";

const publish = createTenantPublisher(bus, {
  headerName: "x-tenant-id",
});

// Automatically adds tenant header from context
await publish({ type: "OrderCreated", payload: { orderId: "123" } });
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `strategy` | `string` | `"header"` | Resolution strategy |
| `headerName` | `string` | `"x-tenant-id"` | Header name for header strategy |
| `correlationSeparator` | `string` | `":"` | Separator for correlation prefix |
| `resolver` | `function` | - | Custom resolver function |
| `required` | `boolean` | `true` | Require tenant on all messages |
| `defaultTenantId` | `string` | - | Default when not required |
| `allowedTenants` | `string[]` | - | Allowlist of valid tenants |
| `prefixSagaId` | `boolean` | `true` | Prefix saga IDs with tenant |

## Context API

```typescript
import {
  getTenantId,
  getTenantInfo,
  requireTenantId,
  runWithTenant,
} from "@saga-bus/middleware-tenant";

// Get current tenant (undefined if not set)
const tenantId = getTenantId();

// Get full tenant info
const info = getTenantInfo(); // { tenantId, originalSagaId }

// Throw if no tenant
const tenantId = requireTenantId();

// Run code with explicit tenant context
await runWithTenant("tenant-123", async () => {
  // getTenantId() returns "tenant-123" here
});
```

## License

MIT
