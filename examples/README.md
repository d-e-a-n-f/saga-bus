# Saga Bus Examples

Example applications demonstrating saga-bus in different deployment scenarios.

## Quick Start

```bash
# Start all services
docker-compose up -d

# Wait for services to be healthy
docker-compose ps

# Open UIs
open http://localhost:3001    # Next.js - Submit orders
open http://localhost:3002/api # NestJS - Swagger docs
open http://localhost:15672   # RabbitMQ Management (saga/saga)
open http://localhost:5050    # pgAdmin (admin@saga-bus.local / saga)
open http://localhost:16686   # Jaeger Tracing
open http://localhost:3003    # Grafana Dashboards
open http://localhost:9090    # Prometheus
```

## Example Applications

### 1. Node Worker (`apps/example-worker`)

**Pattern:** Background worker

A standalone service that:
- Consumes messages from RabbitMQ
- Processes OrderSaga state transitions
- Persists state to PostgreSQL
- Exposes health/metrics endpoints

**Port:** 3000

### 2. Next.js Producer (`apps/example-nextjs`)

**Pattern:** Message producer

A web application that:
- Provides order submission UI
- Publishes messages to RabbitMQ
- Does NOT consume (processing happens elsewhere)

**Port:** 3001

### 3. NestJS API (`apps/example-nestjs`)

**Pattern:** Monolith

A full API service that:
- Provides REST endpoints
- Produces AND consumes messages
- Handles complete saga lifecycle
- Includes Swagger documentation

**Port:** 3002

## Infrastructure Services

| Service | Port | Description |
|---------|------|-------------|
| RabbitMQ | 5672 (AMQP), 15672 (UI) | Message broker |
| PostgreSQL | 5432 | Saga state storage |
| pgAdmin | 5050 | Database admin UI |
| Jaeger | 16686 (UI), 4317/4318 (OTLP) | Distributed tracing |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3003 | Dashboards |

## Order Saga Flow

```
OrderSubmitted
     │
     ▼
┌─────────────────────┐
│  pending            │
│  (request payment)  │
└──────────┬──────────┘
           │
    PaymentCaptured / PaymentFailed
           │
     ┌─────┴─────┐
     ▼           ▼
┌─────────┐  ┌─────────┐
│  paid   │  │cancelled│
└────┬────┘  └─────────┘
     │
     │ InventoryReserved / InventoryFailed
     │
     ┌─────┴─────┐
     ▼           ▼
┌─────────┐  ┌─────────┐
│reserved │  │cancelled│
└────┬────┘  └─────────┘
     │
     │ ShipmentCreated
     ▼
┌─────────────────────┐
│  shipped            │
│  (saga complete)    │
└─────────────────────┘
```

## Testing the Flow

1. **Submit an order** via Next.js (http://localhost:3001) or NestJS API

2. **View message flow** in RabbitMQ Management (http://localhost:15672)
   - Login: saga / saga
   - Check Queues tab for message counts

3. **Simulate downstream services** by publishing response messages:

```bash
# Simulate payment capture
curl -X POST http://localhost:3002/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"test","items":[{"sku":"A","quantity":1,"price":10}]}'

# Note the orderId in the response, then use RabbitMQ UI or CLI
# to publish PaymentCaptured, InventoryReserved, ShipmentCreated messages
```

4. **View traces** in Jaeger (http://localhost:16686)

5. **Monitor metrics** in Grafana (http://localhost:3003)

## Cleanup

```bash
# Stop all services
docker-compose down

# Remove volumes (database data, etc)
docker-compose down -v
```

## License

MIT
