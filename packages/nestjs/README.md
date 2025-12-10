# @saga-bus/nestjs

NestJS module for saga-bus integration.

## Installation

```bash
pnpm add @saga-bus/nestjs
```

## Usage

### Basic Setup

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { SagaBusModule } from "@saga-bus/nestjs";
import { InMemoryTransport } from "@saga-bus/transport-inmemory";
import { InMemorySagaStore } from "@saga-bus/store-inmemory";

@Module({
  imports: [
    SagaBusModule.forRoot({
      transport: new InMemoryTransport(),
      store: new InMemorySagaStore(),
    }),
  ],
})
export class AppModule {}
```

### Async Configuration

```typescript
SagaBusModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    transport: new RabbitMqTransport({
      uri: config.get("RABBITMQ_URI"),
    }),
    store: new PostgresSagaStore({
      pool: new Pool({ connectionString: config.get("DATABASE_URL") }),
    }),
  }),
  inject: [ConfigService],
});
```

## Decorators

### @MessageHandler

Handle specific message types:

```typescript
import { Injectable } from "@nestjs/common";
import { MessageHandler } from "@saga-bus/nestjs";

@Injectable()
export class OrderHandlers {
  @MessageHandler("OrderCreated")
  async handleOrderCreated(message: OrderCreated) {
    console.log("Order created:", message.payload);
  }

  @MessageHandler("OrderShipped")
  async handleOrderShipped(message: OrderShipped) {
    console.log("Order shipped:", message.payload);
  }
}
```

### @InjectSagaBus

Inject the saga bus service:

```typescript
import { Injectable } from "@nestjs/common";
import { InjectSagaBus, SagaBusService } from "@saga-bus/nestjs";

@Injectable()
export class OrderService {
  constructor(@InjectSagaBus() private readonly sagaBus: SagaBusService) {}

  async createOrder(data: CreateOrderDto) {
    await this.sagaBus.publish(
      { type: "OrderCreated", payload: data },
      { endpoint: "orders" }
    );
  }
}
```

## SagaBusService API

```typescript
// Publish a message
await sagaBus.publish(message, options);

// Get underlying transport
const transport = sagaBus.getTransport();

// Get underlying store
const store = sagaBus.getStore();

// Get middleware pipeline
const middleware = sagaBus.getMiddleware();
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `transport` | `Transport` | required | Transport implementation |
| `store` | `SagaStore` | required | Saga store implementation |
| `middleware` | `SagaMiddleware[]` | `[]` | Middleware pipeline |
| `autoStart` | `boolean` | `true` | Auto-start transport |
| `autoStop` | `boolean` | `true` | Auto-stop on destroy |

## Lifecycle

The module automatically:

- Starts the transport on module init (if `autoStart: true`)
- Discovers and registers all `@MessageHandler` decorated methods
- Stops the transport on module destroy (if `autoStop: true`)

## License

MIT
