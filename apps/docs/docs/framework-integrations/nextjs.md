---
sidebar_position: 3
title: Next.js
---

# Next.js Integration

Seamless integration with Next.js App Router and API routes.

## Installation

```bash npm2yarn
npm install @saga-bus/nextjs @saga-bus/core
```

## Basic Setup

```typescript
// lib/saga-bus.ts
import { createSagaBus } from '@saga-bus/nextjs';

export const sagaBus = createSagaBus({
  transport: {
    type: 'sqs',
    region: process.env.AWS_REGION,
    queueUrlPrefix: process.env.SQS_QUEUE_PREFIX,
  },
  store: {
    type: 'dynamodb',
    tableName: process.env.DYNAMODB_TABLE,
    region: process.env.AWS_REGION,
  },
  sagas: [orderSaga, paymentSaga],
});
```

## API Route Handler

```typescript
// app/api/orders/route.ts
import { NextResponse } from 'next/server';
import { sagaBus } from '@/lib/saga-bus';

export async function POST(request: Request) {
  const body = await request.json();
  const orderId = crypto.randomUUID();

  await sagaBus.publish({
    type: 'OrderSubmitted',
    orderId,
    customerId: body.customerId,
    items: body.items,
    total: body.total,
  });

  return NextResponse.json({ orderId });
}
```

## Server Actions

```typescript
// app/actions/orders.ts
'use server';

import { sagaBus } from '@/lib/saga-bus';

export async function submitOrder(formData: FormData) {
  const orderId = crypto.randomUUID();

  await sagaBus.publish({
    type: 'OrderSubmitted',
    orderId,
    customerId: formData.get('customerId'),
    items: JSON.parse(formData.get('items') as string),
  });

  return { orderId };
}
```

## Worker Process

```typescript
// worker.ts
import { startWorker } from '@saga-bus/nextjs';
import { sagaBus } from './lib/saga-bus';

startWorker(sagaBus);
```

## Health Check

```typescript
// app/api/health/route.ts
import { sagaBus } from '@/lib/saga-bus';

export async function GET() {
  const health = await sagaBus.healthCheck();
  return Response.json(health, {
    status: health.status === 'healthy' ? 200 : 503,
  });
}
```

## See Also

- [Framework Integrations Overview](/docs/framework-integrations/overview)
- [AWS SQS Transport](/docs/transports/sqs)
- [DynamoDB Store](/docs/stores/dynamodb)
