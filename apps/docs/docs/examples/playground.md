---
sidebar_position: 6
title: Playground
---

# Saga Playground

Design and visualize your sagas in real-time using actual TypeScript DSL code. Edit the saga definition on the left and watch the flow diagram update instantly.

<LiveSagaEditor height={750} title="Interactive Saga Designer" />

## How It Works

The playground parses your TypeScript saga definition and extracts:

1. **States** from your `status` type in the interface
2. **Transitions** from `.on()` handlers with `.when()` guards

### Requirements for Visualization

For the parser to detect transitions, your handlers should follow this pattern:

```typescript
.on('EventName')
  .when(state => state.status === 'fromState')  // Guard defines "from"
  .handle(async (msg, state) => ({
    ...state,
    status: 'toState',  // Assignment defines "to"
  }))
```

## Examples

### Payment Saga

```typescript
interface PaymentState {
  paymentId: string;
  status: 'pending' | 'validating' | 'charging' | 'captured' | 'declined' | 'refunded';
}

const paymentSaga = createSagaMachine<PaymentState, PaymentMessages>()
  .name('PaymentSaga')
  .correlate('PaymentRequested', msg => msg.paymentId, { canStart: true })

  .initial<PaymentRequested>(msg => ({
    paymentId: msg.paymentId,
    status: 'pending',
  }))

  .on('CardValidated')
    .when(state => state.status === 'pending')
    .handle(async (msg, state) => ({
      ...state,
      status: 'validating',
    }))

  .on('ChargeInitiated')
    .when(state => state.status === 'validating')
    .handle(async (msg, state) => ({
      ...state,
      status: 'charging',
    }))

  .on('ChargeSucceeded')
    .when(state => state.status === 'charging')
    .handle(async (msg, state, ctx) => {
      ctx.complete();
      return { ...state, status: 'captured' };
    })

  .on('ChargeFailed')
    .when(state => state.status === 'charging')
    .handle(async (msg, state, ctx) => {
      ctx.complete();
      return { ...state, status: 'declined' };
    })

  .build();
```

### Loan Application

```typescript
interface LoanState {
  applicationId: string;
  status: 'submitted' | 'identity_check' | 'credit_check' | 'verified' | 'underwriting' | 'approved' | 'rejected' | 'funded';
}

const loanSaga = createSagaMachine<LoanState, LoanMessages>()
  .name('LoanSaga')
  .correlate('ApplicationSubmitted', msg => msg.applicationId, { canStart: true })

  .initial<ApplicationSubmitted>(msg => ({
    applicationId: msg.applicationId,
    status: 'submitted',
  }))

  .on('IdentityVerified')
    .when(state => state.status === 'submitted')
    .handle(async (msg, state) => ({
      ...state,
      status: 'identity_check',
    }))

  .on('CreditChecked')
    .when(state => state.status === 'identity_check')
    .handle(async (msg, state) => ({
      ...state,
      status: 'credit_check',
    }))

  .on('AllChecksComplete')
    .when(state => state.status === 'credit_check')
    .handle(async (msg, state) => ({
      ...state,
      status: 'verified',
    }))

  .on('UnderwritingStarted')
    .when(state => state.status === 'verified')
    .handle(async (msg, state) => ({
      ...state,
      status: 'underwriting',
    }))

  .on('LoanApproved')
    .when(state => state.status === 'underwriting')
    .handle(async (msg, state) => ({
      ...state,
      status: 'approved',
    }))

  .on('LoanRejected')
    .when(state => state.status === 'underwriting')
    .handle(async (msg, state, ctx) => {
      ctx.complete();
      return { ...state, status: 'rejected' };
    })

  .on('FundsTransferred')
    .when(state => state.status === 'approved')
    .handle(async (msg, state, ctx) => {
      ctx.complete();
      return { ...state, status: 'funded' };
    })

  .build();
```

## Tips

1. **Define all status values** in your interface's union type
2. **Use `.when()` guards** to specify the source state
3. **Set `status`** in your handler return to specify the target state
4. **Drag nodes** to rearrange after the diagram generates
5. **Event names** containing "fail", "error", "cancel" get red edges
6. **Event names** containing "success", "complete", "confirm" get green edges

## Limitations

The parser uses regex and works best with standard patterns. Complex expressions in `.when()` guards or computed status values may not be detected.

## See Also

- [DSL Reference](/docs/dsl-reference/overview) - Full API documentation
- [Order Saga](/docs/examples/order-saga) - Complete implementation example
- [Common Patterns](/docs/examples/patterns) - Reusable saga patterns
