---
sidebar_position: 4
title: Common Patterns
---

# Common Saga Patterns

Reusable patterns for building robust saga workflows.

## Compensation Pattern

Undo completed steps when a later step fails.

### Implementation

```typescript
interface OrderState {
  orderId: string;
  status: string;
  compensations: Compensation[];
}

interface Compensation {
  step: string;
  action: 'pending' | 'completed' | 'failed';
  data: Record<string, unknown>;
}

const orderSaga = defineSaga({
  name: 'OrderSaga',
  handlers: {
    PaymentCaptured: async (ctx) => {
      // Record compensation info
      ctx.setState({
        ...ctx.state,
        transactionId: ctx.message.transactionId,
        compensations: [
          ...ctx.state.compensations,
          {
            step: 'payment',
            action: 'pending',
            data: { transactionId: ctx.message.transactionId },
          },
        ],
      });
    },

    InventoryFailed: async (ctx) => {
      // Trigger compensation chain
      ctx.setState({
        ...ctx.state,
        status: 'compensating',
      });

      // Find pending compensations and execute in reverse
      const pending = ctx.state.compensations
        .filter((c) => c.action === 'pending')
        .reverse();

      for (const comp of pending) {
        if (comp.step === 'payment') {
          ctx.publish({
            type: 'RefundPayment',
            orderId: ctx.state.orderId,
            transactionId: comp.data.transactionId,
          });
        }
      }
    },

    RefundCompleted: async (ctx) => {
      // Mark compensation as done
      const compensations = ctx.state.compensations.map((c) =>
        c.step === 'payment' ? { ...c, action: 'completed' } : c
      );

      const allCompensated = compensations.every(
        (c) => c.action !== 'pending'
      );

      ctx.setState({
        ...ctx.state,
        compensations,
        status: allCompensated ? 'cancelled' : ctx.state.status,
      });

      if (allCompensated) {
        ctx.complete();
      }
    },
  },
});
```

### Usage Pattern

```typescript
// Always record compensation info when completing a step
ctx.setState({
  ...ctx.state,
  compensations: [
    ...ctx.state.compensations,
    { step: 'step_name', action: 'pending', data: { ... } },
  ],
});

// On failure, process compensations in reverse order
const pending = ctx.state.compensations
  .filter(c => c.action === 'pending')
  .reverse();
```

## Parallel Steps Pattern

Execute multiple operations concurrently and wait for all to complete.

### Implementation

```typescript
interface VerificationState {
  applicationId: string;
  status: string;
  verifications: {
    identity: boolean | null;
    credit: boolean | null;
    income: boolean | null;
  };
}

const verificationSaga = defineSaga({
  name: 'VerificationSaga',
  initialState: (): VerificationState => ({
    applicationId: '',
    status: 'pending',
    verifications: {
      identity: null,
      credit: null,
      income: null,
    },
  }),
  handlers: {
    StartVerification: async (ctx) => {
      ctx.setState({
        ...ctx.state,
        applicationId: ctx.message.applicationId,
        status: 'verifying',
      });

      // Fire all verifications in parallel
      ctx.publish({ type: 'VerifyIdentity', applicationId: ctx.message.applicationId });
      ctx.publish({ type: 'CheckCredit', applicationId: ctx.message.applicationId });
      ctx.publish({ type: 'VerifyIncome', applicationId: ctx.message.applicationId });
    },

    IdentityVerified: async (ctx) => {
      ctx.setState({
        ...ctx.state,
        verifications: { ...ctx.state.verifications, identity: true },
      });
      await checkAllComplete(ctx);
    },

    IdentityFailed: async (ctx) => {
      ctx.setState({
        ...ctx.state,
        verifications: { ...ctx.state.verifications, identity: false },
      });
      await checkAllComplete(ctx);
    },

    CreditChecked: async (ctx) => {
      ctx.setState({
        ...ctx.state,
        verifications: { ...ctx.state.verifications, credit: true },
      });
      await checkAllComplete(ctx);
    },

    IncomeVerified: async (ctx) => {
      ctx.setState({
        ...ctx.state,
        verifications: { ...ctx.state.verifications, income: true },
      });
      await checkAllComplete(ctx);
    },
  },
});

async function checkAllComplete(ctx) {
  const { identity, credit, income } = ctx.state.verifications;

  // All must be non-null (completed)
  if (identity !== null && credit !== null && income !== null) {
    const allPassed = identity && credit && income;

    ctx.setState({
      ...ctx.state,
      status: allPassed ? 'verified' : 'failed',
    });

    ctx.publish({
      type: allPassed ? 'VerificationPassed' : 'VerificationFailed',
      applicationId: ctx.state.applicationId,
    });

    ctx.complete();
  }
}
```

### Barrier Pattern

Wait for N of M steps to complete:

```typescript
interface ParallelState {
  requiredCompletions: number;
  completedSteps: string[];
}

async function checkBarrier(ctx) {
  if (ctx.state.completedSteps.length >= ctx.state.requiredCompletions) {
    ctx.publish({ type: 'BarrierReached' });
  }
}
```

## Timeout Pattern

Handle missing or delayed events gracefully.

### Implementation

```typescript
const timeoutSaga = defineSaga({
  name: 'OrderWithTimeout',
  handlers: {
    OrderSubmitted: async (ctx) => {
      ctx.setState({
        ...ctx.state,
        orderId: ctx.message.orderId,
        status: 'awaiting_payment',
        paymentDeadline: Date.now() + 15 * 60 * 1000, // 15 minutes
      });

      ctx.publish({
        type: 'RequestPayment',
        orderId: ctx.message.orderId,
      });

      // Schedule timeout
      ctx.scheduleTimeout({
        type: 'PaymentTimeout',
        orderId: ctx.message.orderId,
        delay: 15 * 60 * 1000,
      });
    },

    PaymentCaptured: async (ctx) => {
      // Cancel timeout by advancing past the state
      if (ctx.state.status !== 'awaiting_payment') return;

      ctx.setState({
        ...ctx.state,
        status: 'paid',
        transactionId: ctx.message.transactionId,
      });

      // Continue flow...
    },

    PaymentTimeout: async (ctx) => {
      // Only process if still awaiting payment
      if (ctx.state.status !== 'awaiting_payment') return;

      ctx.setState({
        ...ctx.state,
        status: 'payment_timeout',
        failureReason: 'Payment not received within deadline',
      });

      ctx.publish({
        type: 'OrderCancelled',
        orderId: ctx.state.orderId,
        reason: 'Payment timeout',
      });

      ctx.complete();
    },
  },
});
```

### Sliding Window Timeout

Reset timeout on activity:

```typescript
handlers: {
  ActivityReceived: async (ctx) => {
    // Cancel existing timeout
    ctx.cancelTimeout('InactivityTimeout');

    // Schedule new timeout
    ctx.scheduleTimeout({
      type: 'InactivityTimeout',
      delay: 30 * 60 * 1000, // Reset to 30 minutes
    });
  },
}
```

## State Machine Pattern

Model explicit state transitions with guards.

### Implementation

```typescript
type OrderStatus = 'draft' | 'submitted' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

interface Transition {
  from: OrderStatus | OrderStatus[];
  to: OrderStatus;
  on: string;
  guard?: (ctx: SagaContext) => boolean;
}

const transitions: Transition[] = [
  { from: 'draft', to: 'submitted', on: 'OrderSubmitted' },
  { from: 'submitted', to: 'paid', on: 'PaymentCaptured' },
  { from: 'submitted', to: 'cancelled', on: 'OrderCancelled' },
  { from: 'paid', to: 'shipped', on: 'ShipmentCreated' },
  { from: 'paid', to: 'cancelled', on: 'OrderCancelled', guard: (ctx) => !ctx.state.shipped },
  { from: 'shipped', to: 'delivered', on: 'DeliveryConfirmed' },
];

function canTransition(
  currentStatus: OrderStatus,
  eventType: string,
  ctx: SagaContext
): Transition | undefined {
  return transitions.find((t) => {
    const fromMatch = Array.isArray(t.from)
      ? t.from.includes(currentStatus)
      : t.from === currentStatus;
    const eventMatch = t.on === eventType;
    const guardPass = !t.guard || t.guard(ctx);
    return fromMatch && eventMatch && guardPass;
  });
}

const stateMachineSaga = defineSaga({
  name: 'StateMachineOrder',
  handlers: {
    '*': async (ctx) => {
      const transition = canTransition(ctx.state.status, ctx.message.type, ctx);

      if (!transition) {
        // Invalid transition - log and ignore
        console.warn(`Invalid transition: ${ctx.state.status} -> ${ctx.message.type}`);
        return;
      }

      ctx.setState({
        ...ctx.state,
        status: transition.to,
        lastTransition: {
          from: ctx.state.status,
          to: transition.to,
          event: ctx.message.type,
          at: new Date().toISOString(),
        },
      });

      // Perform side effects based on new state
      await onStateEnter(ctx, transition.to);
    },
  },
});

async function onStateEnter(ctx: SagaContext, state: OrderStatus) {
  switch (state) {
    case 'submitted':
      ctx.publish({ type: 'RequestPayment', orderId: ctx.state.orderId });
      break;
    case 'paid':
      ctx.publish({ type: 'ReserveInventory', orderId: ctx.state.orderId });
      break;
    case 'delivered':
      ctx.complete();
      break;
  }
}
```

## Retry Pattern

Automatically retry failed operations with backoff.

### Implementation

```typescript
interface RetryState {
  lastError?: string;
  retryCount: number;
  nextRetryAt?: number;
}

const retrySaga = defineSaga({
  name: 'RetryableSaga',
  handlers: {
    ProcessOrder: async (ctx) => {
      try {
        await externalService.process(ctx.state.orderId);

        ctx.setState({
          ...ctx.state,
          status: 'processed',
          retryCount: 0,
        });
      } catch (error) {
        await handleRetry(ctx, error);
      }
    },

    RetryProcess: async (ctx) => {
      // Re-attempt the operation
      try {
        await externalService.process(ctx.state.orderId);

        ctx.setState({
          ...ctx.state,
          status: 'processed',
          retryCount: 0,
        });
      } catch (error) {
        await handleRetry(ctx, error);
      }
    },
  },
});

async function handleRetry(ctx, error: Error) {
  const maxRetries = 5;
  const newRetryCount = ctx.state.retryCount + 1;

  if (newRetryCount > maxRetries) {
    ctx.setState({
      ...ctx.state,
      status: 'failed',
      lastError: error.message,
    });

    ctx.publish({
      type: 'ProcessingFailed',
      orderId: ctx.state.orderId,
      reason: 'Max retries exceeded',
    });

    return;
  }

  // Exponential backoff with jitter
  const baseDelay = 1000;
  const delay = Math.min(
    baseDelay * Math.pow(2, newRetryCount) + Math.random() * 1000,
    60000 // Max 1 minute
  );

  ctx.setState({
    ...ctx.state,
    retryCount: newRetryCount,
    lastError: error.message,
    nextRetryAt: Date.now() + delay,
  });

  ctx.scheduleTimeout({
    type: 'RetryProcess',
    orderId: ctx.state.orderId,
    delay,
  });
}
```

## Idempotency Pattern

Ensure handlers can be safely re-executed.

### Implementation

```typescript
interface IdempotentState {
  processedMessages: Set<string>;
}

const idempotentSaga = defineSaga({
  name: 'IdempotentSaga',
  handlers: {
    PaymentCaptured: async (ctx) => {
      const messageId = ctx.message.messageId || ctx.metadata.get('messageId');

      // Check if already processed
      if (ctx.state.processedMessages.has(messageId)) {
        return; // Skip duplicate
      }

      // Process the message
      ctx.setState({
        ...ctx.state,
        status: 'paid',
        transactionId: ctx.message.transactionId,
        processedMessages: new Set([
          ...ctx.state.processedMessages,
          messageId,
        ]),
      });

      // Continue with side effects...
    },
  },
});
```

### Status-Based Idempotency

```typescript
handlers: {
  PaymentCaptured: async (ctx) => {
    // Idempotent: only process if in expected state
    if (ctx.state.status !== 'awaiting_payment') {
      return;
    }

    ctx.setState({
      ...ctx.state,
      status: 'paid',
    });
  },
}
```

## Scatter-Gather Pattern

Send requests to multiple services and aggregate responses.

### Implementation

```typescript
interface QuoteState {
  requestId: string;
  itemId: string;
  vendors: string[];
  quotes: Quote[];
  status: 'requesting' | 'complete';
}

interface Quote {
  vendor: string;
  price: number;
  deliveryDays: number;
}

const scatterGatherSaga = defineSaga({
  name: 'QuoteGatherer',
  handlers: {
    RequestQuotes: async (ctx) => {
      const vendors = ['vendor-a', 'vendor-b', 'vendor-c'];

      ctx.setState({
        ...ctx.state,
        requestId: ctx.message.requestId,
        itemId: ctx.message.itemId,
        vendors,
        quotes: [],
        status: 'requesting',
      });

      // Scatter: request from all vendors
      for (const vendor of vendors) {
        ctx.publish({
          type: 'RequestVendorQuote',
          requestId: ctx.message.requestId,
          itemId: ctx.message.itemId,
          vendor,
        });
      }

      // Set timeout for gathering
      ctx.scheduleTimeout({
        type: 'QuoteTimeout',
        requestId: ctx.message.requestId,
        delay: 30000, // 30 seconds
      });
    },

    VendorQuoteReceived: async (ctx) => {
      if (ctx.state.status !== 'requesting') return;

      const newQuotes = [
        ...ctx.state.quotes,
        {
          vendor: ctx.message.vendor,
          price: ctx.message.price,
          deliveryDays: ctx.message.deliveryDays,
        },
      ];

      ctx.setState({
        ...ctx.state,
        quotes: newQuotes,
      });

      // Check if all gathered
      if (newQuotes.length === ctx.state.vendors.length) {
        await completeGathering(ctx);
      }
    },

    QuoteTimeout: async (ctx) => {
      if (ctx.state.status !== 'requesting') return;

      // Complete with whatever we have
      await completeGathering(ctx);
    },
  },
});

async function completeGathering(ctx) {
  // Find best quote
  const bestQuote = ctx.state.quotes.reduce((best, quote) =>
    !best || quote.price < best.price ? quote : best
  , null);

  ctx.setState({
    ...ctx.state,
    status: 'complete',
  });

  ctx.publish({
    type: 'QuotesGathered',
    requestId: ctx.state.requestId,
    quotes: ctx.state.quotes,
    recommendation: bestQuote,
  });

  ctx.complete();
}
```

## Best Practices

1. **Always make handlers idempotent** - They may be called multiple times
2. **Record compensation data** - Know how to undo each step
3. **Use timeouts liberally** - Don't wait forever for events
4. **Guard state transitions** - Validate current state before changing
5. **Keep state minimal** - Only store what's needed for the workflow
6. **Log state changes** - Aids debugging and auditing
7. **Test failure paths** - Compensation and timeout handling

## See Also

- [Order Saga](/docs/examples/order-saga) - Simple implementation
- [Loan Application](/docs/examples/loan-application) - Complex implementation
- [Testing Overview](/docs/testing/overview) - Testing patterns
