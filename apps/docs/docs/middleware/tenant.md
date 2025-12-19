---
sidebar_position: 7
title: Multi-Tenant
---

# Multi-Tenant Middleware

Tenant context extraction and isolation for SaaS applications.

## Installation

```bash npm2yarn
npm install @saga-bus/middleware-tenant
```

## Basic Usage

```typescript
import { createTenantMiddleware, getTenantId } from '@saga-bus/middleware-tenant';

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
  middleware: [
    createTenantMiddleware({
      extractTenantId: (context) => context.headers['x-tenant-id'],
    }),
  ],
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `extractTenantId` | `function` | Required | Extract tenant from context |
| `required` | `boolean` | `true` | Require tenant ID |
| `validateTenant` | `function` | - | Validate tenant exists |
| `onMissing` | `function` | throw | Handle missing tenant |
| `propagate` | `boolean` | `true` | Propagate to published messages |

## Full Configuration Example

```typescript
import { createTenantMiddleware, getTenantId, setTenantContext } from '@saga-bus/middleware-tenant';

const tenantMiddleware = createTenantMiddleware({
  // Extract tenant from message headers
  extractTenantId: (context) => {
    return context.headers['x-tenant-id']
      || context.message.tenantId;
  },

  // Tenant is required
  required: true,

  // Validate tenant exists
  validateTenant: async (tenantId) => {
    const tenant = await tenantService.findById(tenantId);
    if (!tenant) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    if (!tenant.isActive) {
      throw new Error(`Tenant suspended: ${tenantId}`);
    }
    return tenant;
  },

  // Handle missing tenant
  onMissing: (context) => {
    logger.error('Missing tenant ID', { messageType: context.messageType });
    throw new TenantRequiredError();
  },

  // Propagate tenant to published messages
  propagate: true,
});
```

## Accessing Tenant Context

### In Saga Handlers

```typescript
import { getTenantId, getTenant } from '@saga-bus/middleware-tenant';

const orderSaga = defineSaga<OrderState>({
  name: 'OrderSaga',
})
  .handle('OrderSubmitted', async (context) => {
    // Get tenant ID
    const tenantId = getTenantId();

    // Get full tenant object (if validateTenant returns it)
    const tenant = getTenant();

    // Use tenant-specific database
    const db = getDatabaseForTenant(tenantId);

    // Use tenant-specific configuration
    const config = await getConfigForTenant(tenantId);
  });
```

### In Services

```typescript
import { getTenantId } from '@saga-bus/middleware-tenant';

class OrderService {
  async createOrder(data: CreateOrderData) {
    const tenantId = getTenantId();

    return this.orderRepo.create({
      ...data,
      tenantId,
    });
  }
}
```

## Tenant Isolation Strategies

### Database Per Tenant

```typescript
import { getTenantId } from '@saga-bus/middleware-tenant';

function getDatabaseConnection() {
  const tenantId = getTenantId();
  return connectionPool.get(`tenant_${tenantId}`);
}
```

### Schema Per Tenant

```typescript
import { getTenantId } from '@saga-bus/middleware-tenant';

function getSchemaName() {
  const tenantId = getTenantId();
  return `tenant_${tenantId}`;
}

// In queries
const orders = await db.query(
  `SELECT * FROM ${getSchemaName()}.orders WHERE id = $1`,
  [orderId]
);
```

### Row-Level Security

```typescript
import { getTenantId } from '@saga-bus/middleware-tenant';

class OrderRepository {
  async findAll() {
    const tenantId = getTenantId();
    return this.db.query(
      'SELECT * FROM orders WHERE tenant_id = $1',
      [tenantId]
    );
  }
}
```

## Message Propagation

Tenant ID automatically propagates to published messages:

```typescript
// When processing message with tenant "acme"
await context.publish({
  type: 'PaymentRequested',
  orderId: '123',
});

// Published message automatically includes:
// headers: { 'x-tenant-id': 'acme' }
```

## Extraction Strategies

### From Headers

```typescript
extractTenantId: (context) => context.headers['x-tenant-id']
```

### From Message Body

```typescript
extractTenantId: (context) => context.message.tenantId
```

### From Correlation ID

```typescript
// If correlation ID format is: tenant:order-123
extractTenantId: (context) => {
  const [tenantId] = context.correlationId.split(':');
  return tenantId;
}
```

### From JWT Token

```typescript
import jwt from 'jsonwebtoken';

extractTenantId: (context) => {
  const token = context.headers['authorization']?.replace('Bearer ', '');
  if (!token) return null;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded.tenantId;
}
```

## Error Handling

### Missing Tenant

```typescript
createTenantMiddleware({
  extractTenantId: (ctx) => ctx.headers['x-tenant-id'],
  required: true,
  onMissing: (context) => {
    // Option 1: Throw error
    throw new TenantRequiredError();

    // Option 2: Use default tenant
    return 'default';

    // Option 3: Skip processing
    return { action: 'skip' };
  },
});
```

### Invalid Tenant

```typescript
createTenantMiddleware({
  extractTenantId: (ctx) => ctx.headers['x-tenant-id'],
  validateTenant: async (tenantId) => {
    const tenant = await tenantService.findById(tenantId);
    if (!tenant) {
      throw new InvalidTenantError(tenantId);
    }
    return tenant;
  },
});
```

## Testing

```typescript
import { setTenantContext, clearTenantContext } from '@saga-bus/middleware-tenant';

describe('OrderService', () => {
  beforeEach(() => {
    setTenantContext('test-tenant');
  });

  afterEach(() => {
    clearTenantContext();
  });

  it('creates order with tenant', async () => {
    const order = await orderService.createOrder({ ... });
    expect(order.tenantId).toBe('test-tenant');
  });
});
```

## Best Practices

### Always Validate Tenants

```typescript
validateTenant: async (tenantId) => {
  const tenant = await cache.getOrFetch(
    `tenant:${tenantId}`,
    () => tenantService.findById(tenantId)
  );
  if (!tenant || !tenant.isActive) {
    throw new InvalidTenantError(tenantId);
  }
  return tenant;
}
```

### Use Tenant-Aware Logging

```typescript
import { getTenantId } from '@saga-bus/middleware-tenant';

logger.info('Order created', {
  orderId: order.id,
  tenantId: getTenantId(),
});
```

### Propagate to All External Calls

```typescript
import { getTenantId } from '@saga-bus/middleware-tenant';

const response = await fetch(externalApi, {
  headers: {
    'X-Tenant-ID': getTenantId(),
  },
});
```

## See Also

- [Middleware Overview](/docs/middleware/overview)
- [Custom Middleware](/docs/middleware/custom-middleware)
- [Scaling](/docs/production/scaling)
