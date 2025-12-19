---
sidebar_position: 2
title: NestJS
---

# NestJS Integration

Full dependency injection support with decorators for NestJS applications.

## Installation

```bash npm2yarn
npm install @saga-bus/nestjs @saga-bus/core
```

## Basic Usage

```typescript
import { Module } from '@nestjs/common';
import { SagaBusModule } from '@saga-bus/nestjs';

@Module({
  imports: [
    SagaBusModule.forRoot({
      transport: {
        type: 'rabbitmq',
        url: process.env.RABBITMQ_URL,
      },
      store: {
        type: 'postgres',
        connectionString: process.env.DATABASE_URL,
      },
    }),
  ],
})
export class AppModule {}
```

## Configuration

### Synchronous Configuration

```typescript
SagaBusModule.forRoot({
  transport: {
    type: 'rabbitmq',
    url: 'amqp://localhost:5672',
  },
  store: {
    type: 'postgres',
    connectionString: 'postgresql://localhost/sagas',
  },
  middleware: [
    { type: 'logging', level: 'info' },
    { type: 'tracing', serviceName: 'order-service' },
  ],
})
```

### Async Configuration

```typescript
SagaBusModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    transport: {
      type: 'rabbitmq',
      url: config.get('RABBITMQ_URL'),
    },
    store: {
      type: 'postgres',
      connectionString: config.get('DATABASE_URL'),
    },
  }),
  inject: [ConfigService],
})
```

## Defining Sagas

### Using Decorators

```typescript
import { Injectable } from '@nestjs/common';
import { Saga, SagaHandler, InitialState, CorrelatedBy } from '@saga-bus/nestjs';

interface OrderState {
  orderId: string;
  status: string;
  customerId: string;
}

@Injectable()
@Saga('OrderSaga')
export class OrderSaga {
  @InitialState()
  createInitialState(): OrderState {
    return {
      orderId: '',
      status: 'pending',
      customerId: '',
    };
  }

  @CorrelatedBy('orderId')
  @SagaHandler('OrderSubmitted', { initiates: true })
  async handleOrderSubmitted(context: SagaContext<OrderState, OrderSubmitted>) {
    context.setState({
      orderId: context.message.orderId,
      status: 'submitted',
      customerId: context.message.customerId,
    });

    await context.publish({
      type: 'RequestPayment',
      orderId: context.message.orderId,
      amount: context.message.total,
    });
  }

  @SagaHandler('PaymentCaptured')
  async handlePaymentCaptured(context: SagaContext<OrderState, PaymentCaptured>) {
    context.setState({ status: 'paid' });

    await context.publish({
      type: 'ReserveInventory',
      orderId: context.state.orderId,
    });
  }

  @SagaHandler('InventoryReserved')
  async handleInventoryReserved(context: SagaContext<OrderState, InventoryReserved>) {
    context.setState({ status: 'completed' });
    context.complete();
  }
}
```

### Registering Sagas

```typescript
@Module({
  imports: [
    SagaBusModule.forRoot({ ... }),
    SagaBusModule.forFeature([OrderSaga, PaymentSaga]),
  ],
  providers: [OrderSaga, PaymentSaga],
})
export class OrderModule {}
```

## Publishing Messages

### Inject Bus Service

```typescript
import { Injectable } from '@nestjs/common';
import { SagaBusService } from '@saga-bus/nestjs';

@Injectable()
export class OrderService {
  constructor(private readonly sagaBus: SagaBusService) {}

  async createOrder(data: CreateOrderDto) {
    await this.sagaBus.publish({
      type: 'OrderSubmitted',
      orderId: generateId(),
      customerId: data.customerId,
      items: data.items,
      total: data.total,
    });
  }
}
```

### In Controllers

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { SagaBusService } from '@saga-bus/nestjs';

@Controller('orders')
export class OrderController {
  constructor(private readonly sagaBus: SagaBusService) {}

  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    const orderId = generateId();

    await this.sagaBus.publish({
      type: 'OrderSubmitted',
      orderId,
      ...dto,
    });

    return { orderId };
  }
}
```

## Health Checks

### Built-in Health Indicator

```typescript
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { SagaBusModule, SagaBusHealthIndicator } from '@saga-bus/nestjs';

@Module({
  imports: [
    TerminusModule,
    SagaBusModule.forRoot({ ... }),
  ],
  providers: [SagaBusHealthIndicator],
})
export class HealthModule {}
```

### Health Controller

```typescript
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SagaBusHealthIndicator } from '@saga-bus/nestjs';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private sagaBus: SagaBusHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.sagaBus.isHealthy('saga-bus'),
    ]);
  }
}
```

## Dependency Injection in Sagas

```typescript
@Injectable()
@Saga('OrderSaga')
export class OrderSaga {
  constructor(
    private readonly orderService: OrderService,
    private readonly paymentGateway: PaymentGateway,
    private readonly notificationService: NotificationService,
  ) {}

  @SagaHandler('OrderSubmitted', { initiates: true })
  async handleOrderSubmitted(context: SagaContext<OrderState, OrderSubmitted>) {
    // Use injected services
    const order = await this.orderService.create(context.message);
    await this.notificationService.sendOrderConfirmation(order);

    context.setState({ orderId: order.id, status: 'submitted' });
  }
}
```

## Testing

```typescript
import { Test } from '@nestjs/testing';
import { SagaBusModule, TestSagaBusModule } from '@saga-bus/nestjs';

describe('OrderSaga', () => {
  let module: TestingModule;
  let sagaBus: SagaBusService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        TestSagaBusModule.forRoot(), // Uses in-memory transport/store
      ],
      providers: [OrderSaga],
    }).compile();

    sagaBus = module.get(SagaBusService);
  });

  it('processes order flow', async () => {
    await sagaBus.publish({ type: 'OrderSubmitted', orderId: '123' });

    // Wait for processing
    await sagaBus.waitForSaga('OrderSaga', '123');

    const state = await sagaBus.getSagaState('OrderSaga', '123');
    expect(state.status).toBe('submitted');
  });
});
```

## See Also

- [Framework Integrations Overview](/docs/framework-integrations/overview)
- [Testing](/docs/testing/overview)
- [Deployment](/docs/production/deployment)
