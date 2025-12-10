# @saga-bus/example-nestjs

NestJS API demonstrating the "monolith" pattern with saga-bus.

## Overview

This example shows a full-featured API that:
- Provides REST endpoints for order operations
- Both produces AND consumes messages
- Handles complete saga lifecycle in one service
- Includes Swagger documentation

## Running

### With Docker Compose (Recommended)

```bash
# From repository root
cd examples
docker-compose up -d

# API available at http://localhost:3002
# Swagger docs at http://localhost:3002/api
```

### Local Development

```bash
# Start infrastructure
cd examples
docker-compose up -d rabbitmq postgres

# Run NestJS dev server
pnpm dev
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/orders` | POST | Submit a new order |
| `/health` | GET | Health check |
| `/health/live` | GET | Liveness probe |
| `/health/ready` | GET | Readiness probe |
| `/api` | GET | Swagger documentation |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RABBITMQ_URL` | `amqp://saga:saga@localhost:5672` | RabbitMQ connection URL |
| `RABBITMQ_EXCHANGE` | `saga-bus` | RabbitMQ exchange name |
| `DATABASE_URL` | `postgresql://saga:saga@localhost:5432/saga_bus` | PostgreSQL connection string |
| `PORT` | `3002` | Server port |
| `HOST` | `0.0.0.0` | Server host |

## API Usage

### Submit Order

```bash
curl -X POST http://localhost:3002/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-123",
    "items": [
      { "sku": "WIDGET-001", "quantity": 2, "price": 29.99 }
    ]
  }'
```

Response:
```json
{
  "orderId": "order-abc-123",
  "message": "Order submitted successfully"
}
```

## Architecture

```
Client ──► NestJS API ──► RabbitMQ ──► Same NestJS API
                │                            │
                └────── PostgreSQL ◄─────────┘
```

This demonstrates a traditional monolith architecture where a single service handles both message production and consumption.

## License

MIT
