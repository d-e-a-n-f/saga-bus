---
sidebar_position: 1
title: Deployment
---

# Deployment

Deploy saga-bus applications to various environments with best practices for production.

## Docker

### Basic Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build application
COPY . .
RUN npm run build

# Production image
FROM node:20-alpine
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Multi-Stage Build with pnpm

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY pnpm-lock.yaml package.json ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

USER node

CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  saga-worker:
    build: .
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://user:pass@db:5432/sagas
      - RABBITMQ_URL=amqp://rabbitmq:5672
    depends_on:
      db:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
        max_attempts: 3

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=sagas
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d sagas"]
      interval: 10s
      timeout: 5s
      retries: 5

  rabbitmq:
    image: rabbitmq:3-management-alpine
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "check_running"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

## Kubernetes

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: saga-worker
  labels:
    app: saga-worker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: saga-worker
  template:
    metadata:
      labels:
        app: saga-worker
    spec:
      containers:
        - name: saga-worker
          image: your-registry/saga-worker:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: saga-secrets
                  key: database-url
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: saga-worker
spec:
  selector:
    app: saga-worker
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP
```

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: saga-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: saga-worker
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: saga-config
data:
  SAGA_TIMEOUT_MS: "300000"
  MAX_RETRIES: "3"
  LOG_LEVEL: "info"
```

### Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: saga-secrets
type: Opaque
stringData:
  database-url: "postgres://user:pass@postgres:5432/sagas"
  rabbitmq-url: "amqp://guest:guest@rabbitmq:5672"
```

## AWS Deployment

### ECS Task Definition

```json
{
  "family": "saga-worker",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::123456789:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "saga-worker",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/saga-worker:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:saga/database-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/saga-worker",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health/live || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

### Terraform

```hcl
resource "aws_ecs_service" "saga_worker" {
  name            = "saga-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.saga_worker.arn
  desired_count   = 3
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnets
    security_groups  = [aws_security_group.saga_worker.id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.saga_worker.arn
  }
}

resource "aws_appautoscaling_target" "saga_worker" {
  max_capacity       = 10
  min_capacity       = 3
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.saga_worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "saga_worker_cpu" {
  name               = "saga-worker-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.saga_worker.resource_id
  scalable_dimension = aws_appautoscaling_target.saga_worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.saga_worker.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}
```

## Environment Variables

### Configuration

```typescript
// config.ts
import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().url(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  SAGA_TIMEOUT_MS: z.coerce.number().default(300000),
  MAX_RETRIES: z.coerce.number().default(3),
});

export const config = configSchema.parse(process.env);
```

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `postgres://user:pass@host:5432/db` |
| `RABBITMQ_URL` | RabbitMQ connection string | `amqp://user:pass@host:5672` |
| `NODE_ENV` | Environment name | `production` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `LOG_LEVEL` | `info` | Logging verbosity |
| `SAGA_TIMEOUT_MS` | `300000` | Default saga timeout |
| `MAX_RETRIES` | `3` | Max retry attempts |

## Graceful Shutdown

```typescript
import { createBus } from '@saga-bus/core';

const bus = createBus({ ... });

async function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}, shutting down gracefully...`);

  // Stop accepting new messages
  await bus.stop();

  // Wait for in-flight messages to complete
  await bus.drain({ timeout: 30000 });

  // Close database connections
  await store.close();

  console.log('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the bus
await bus.start();
```

## Rolling Deployments

### Zero-Downtime Updates

1. **Deploy new version alongside existing**
2. **Wait for health checks to pass**
3. **Gradually shift traffic**
4. **Drain old instances**

```yaml
# Kubernetes rolling update strategy
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

## See Also

- [Health Checks](/docs/production/health-checks)
- [Scaling](/docs/production/scaling)
- [Observability](/docs/production/observability)
