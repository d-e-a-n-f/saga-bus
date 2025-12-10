# @saga-bus/examples-shared

Shared types, messages, and saga definitions used by saga-bus example applications.

## Contents

### Messages

Order lifecycle messages for the example Order Saga:

- `OrderSubmitted` - Initial order creation
- `PaymentRequested` / `PaymentCaptured` / `PaymentFailed`
- `InventoryReserveRequested` / `InventoryReserved` / `InventoryReservationFailed`
- `ShipmentRequested` / `ShipmentCreated`
- `OrderCancelled` / `OrderCompleted`

### Sagas

**OrderSaga** - Complete order fulfillment saga demonstrating:
- Multi-step workflow coordination
- State guards for status-based transitions
- Compensation (cancellation) handling
- Command publishing to downstream services

### Types

- `OrderSagaState` - Saga state with order details and status tracking
- `OrderStatus` - Order lifecycle states
- `OrderItem` - Line item structure

## Usage

```typescript
import {
  OrderSaga,
  OrderSagaState,
  OrderSubmitted,
  OrderMessage
} from "@saga-bus/examples-shared";
```

## License

MIT
