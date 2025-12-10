import { Module } from "@nestjs/common";
import { Pool } from "pg";
import { SagaBusModule } from "@saga-bus/nestjs";
import { RabbitMqTransport } from "@saga-bus/transport-rabbitmq";
import { PostgresSagaStore } from "@saga-bus/store-postgres";
import { createLoggingMiddleware } from "@saga-bus/middleware-logging";
import { OrderSaga, type OrderSagaState } from "@saga-bus/examples-shared";
import { OrdersModule } from "./orders/orders.module.js";
import { HealthModule } from "./health/health.module.js";

@Module({
  imports: [
    SagaBusModule.forRootAsync({
      useFactory: () => {
        const pool = new Pool({
          connectionString:
            process.env.DATABASE_URL ??
            "postgresql://saga:saga@localhost:5432/saga_bus",
        });

        const transport = new RabbitMqTransport({
          uri: process.env.RABBITMQ_URL ?? "amqp://saga:saga@localhost:5672",
          exchange: process.env.RABBITMQ_EXCHANGE ?? "saga-bus",
          exchangeType: "topic",
          durable: true,
        });

        const store = new PostgresSagaStore<OrderSagaState>({ pool });

        const loggingMiddleware = createLoggingMiddleware({
          level: "info",
          logPayload: true,
        });

        return {
          transport,
          store,
          sagas: [OrderSaga],
          middleware: [loggingMiddleware],
          autoStart: true,
        };
      },
    }),
    OrdersModule,
    HealthModule,
  ],
})
export class AppModule {}
