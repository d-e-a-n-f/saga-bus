# @saga-bus/example-nextjs

Next.js application demonstrating the "producer" pattern with saga-bus.

## Overview

This example shows a web UI that:
- Provides a form to submit orders
- Publishes OrderSubmitted messages to RabbitMQ
- Does NOT consume messages (processing happens in the worker)

## Running

### With Docker Compose (Recommended)

```bash
# From repository root
cd examples
docker-compose up -d

# App available at http://localhost:3001
```

### Local Development

```bash
# Start infrastructure
cd examples
docker-compose up -d rabbitmq

# Run Next.js dev server
pnpm dev
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Order submission form |
| `/api/orders` | POST endpoint to submit orders |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RABBITMQ_URL` | `amqp://saga:saga@localhost:5672` | RabbitMQ connection URL |
| `RABBITMQ_EXCHANGE` | `saga-bus` | RabbitMQ exchange name |

## How It Works

1. User fills out the order form (customer ID, items, quantities, prices)
2. Form submits to `/api/orders`
3. API route generates order ID and publishes `OrderSubmitted` message
4. Message is consumed by the worker service
5. Worker processes the OrderSaga state machine

## Architecture

```
Browser ──► Next.js API ──► RabbitMQ ──► Worker
```

This demonstrates separation of concerns:
- Web tier handles user interaction and message publishing
- Worker tier handles saga processing

## License

MIT
