# @saga-bus/nextjs

Next.js helpers for saga-bus integration.

## Installation

```bash
pnpm add @saga-bus/nextjs
```

## Usage

### Server Setup

```typescript
// lib/saga-bus.ts
import { createSagaBus } from "@saga-bus/nextjs/server";
import { InMemoryTransport } from "@saga-bus/transport-inmemory";
import { InMemorySagaStore } from "@saga-bus/store-inmemory";

export const sagaBus = createSagaBus({
  transport: new InMemoryTransport(),
  store: new InMemorySagaStore(),
});
```

### API Route (App Router)

```typescript
// app/api/saga/route.ts
import { createSagaHandler } from "@saga-bus/nextjs/api";
import { sagaBus } from "@/lib/saga-bus";

export const POST = createSagaHandler(sagaBus);
```

### Server Components

```typescript
// app/orders/[id]/page.tsx
import { getSagaState } from "@saga-bus/nextjs/server";
import { sagaBus } from "@/lib/saga-bus";

export default async function OrderPage({ params }: { params: { id: string } }) {
  const state = await getSagaState(sagaBus, "OrderSaga", params.id);
  return <div>Status: {state?.status}</div>;
}
```

### Client Components

```typescript
// components/OrderStatus.tsx
"use client";

import { useSagaState } from "@saga-bus/nextjs/client";

export function OrderStatus({ orderId }: { orderId: string }) {
  const { state, isLoading, publish } = useSagaState("OrderSaga", orderId);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <p>Status: {state?.status}</p>
      <button onClick={() => publish("OrderCancelled", { orderId })}>
        Cancel
      </button>
    </div>
  );
}
```

### Provider Setup

```typescript
// app/layout.tsx
import { SagaBusProvider } from "@saga-bus/nextjs/client";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SagaBusProvider apiEndpoint="/api/saga">
          {children}
        </SagaBusProvider>
      </body>
    </html>
  );
}
```

## Exports

### Server (`@saga-bus/nextjs/server`)

- `createSagaBus(config)` - Create saga bus instance
- `getSagaState(bus, sagaName, id)` - Get saga state
- `withSagaBus(bus, handler)` - Wrap API handler with context

### API (`@saga-bus/nextjs/api`)

- `createSagaHandler(bus)` - Create API route handler

### Client (`@saga-bus/nextjs/client`)

- `SagaBusProvider` - React context provider
- `useSagaBusConfig()` - Access provider config
- `useSagaState(sagaName, id)` - Fetch and interact with saga
- `usePublish()` - Publish messages

## API Actions

The API handler supports these actions:

| Action | Description |
|--------|-------------|
| `publish` | Publish a message |
| `getState` | Get saga state by ID |
| `getStateByCorrelation` | Get state by correlation ID |

## Configuration

### Server Config

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `transport` | `Transport` | required | Transport implementation |
| `store` | `SagaStore` | required | Saga store implementation |
| `defaultEndpoint` | `string` | `"saga-bus"` | Default publish endpoint |

### Client Config

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiEndpoint` | `string` | `"/api/saga"` | API endpoint URL |

## License

MIT
