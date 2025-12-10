# @saga-bus/example-worker

Standalone saga worker demonstrating background message processing.

## Overview

This example shows the "worker" pattern - a dedicated service that:
- Consumes messages from RabbitMQ
- Processes OrderSaga state transitions
- Persists saga state to PostgreSQL
- Exposes health/metrics endpoints

## Running

### With Docker Compose (Recommended)

```bash
# From repository root
cd examples
docker-compose up -d

# Worker available at http://localhost:3000
```

### Local Development

```bash
# Start infrastructure
cd examples
docker-compose up -d rabbitmq postgres

# Run worker
pnpm dev
```

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check with dependency status |
| `GET /health/live` | Liveness probe (always 200 if running) |
| `GET /health/ready` | Readiness probe (checks dependencies) |
| `GET /metrics` | Prometheus metrics |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RABBITMQ_URL` | `amqp://saga:saga@localhost:5672` | RabbitMQ connection URL |
| `DATABASE_URL` | `postgresql://saga:saga@localhost:5432/saga_bus` | PostgreSQL connection string |
| `PORT` | `3000` | Health server port |
| `HOST` | `0.0.0.0` | Health server host |

## Architecture

```
RabbitMQ ──► Worker ──► PostgreSQL
              │
              └──► Prometheus (/metrics)
```

The worker subscribes to message types handled by `OrderSaga` and processes each message through the saga state machine.

## License

MIT
