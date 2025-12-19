---
sidebar_position: 2
title: Health Checks
---

# Health Checks

Implement health checks to ensure saga workers are running correctly and can handle traffic.

## Liveness vs Readiness

### Liveness Probe

Answers: **"Is the process alive?"**

- Used by orchestrators to restart unhealthy containers
- Should be fast and simple
- Fails only if the process is deadlocked or crashed

### Readiness Probe

Answers: **"Can the service accept traffic?"**

- Used by load balancers to route traffic
- Checks if dependencies are available
- Fails during startup or degraded states

## Basic Implementation

```typescript
import express from 'express';
import { createBus } from '@saga-bus/core';

const app = express();
const bus = createBus({ ... });

// Liveness - always returns OK if the process is running
app.get('/health/live', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness - checks if bus is ready to process messages
app.get('/health/ready', async (req, res) => {
  const isReady = bus.isRunning();

  if (isReady) {
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
    });
  }
});
```

## Comprehensive Health Checks

### Checking Dependencies

```typescript
interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, ComponentHealth>;
  timestamp: string;
}

interface ComponentHealth {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  message?: string;
}

async function checkHealth(): Promise<HealthCheckResult> {
  const checks: Record<string, ComponentHealth> = {};

  // Check bus status
  checks.bus = {
    status: bus.isRunning() ? 'healthy' : 'unhealthy',
  };

  // Check database
  const dbStart = Date.now();
  try {
    await store.ping();
    checks.database = {
      status: 'healthy',
      latency: Date.now() - dbStart,
    };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      message: error.message,
    };
  }

  // Check message transport
  const transportStart = Date.now();
  try {
    await transport.ping();
    checks.transport = {
      status: 'healthy',
      latency: Date.now() - transportStart,
    };
  } catch (error) {
    checks.transport = {
      status: 'unhealthy',
      message: error.message,
    };
  }

  // Determine overall status
  const unhealthyChecks = Object.values(checks).filter(
    (c) => c.status === 'unhealthy'
  );

  let status: HealthCheckResult['status'];
  if (unhealthyChecks.length === 0) {
    status = 'healthy';
  } else if (unhealthyChecks.length < Object.keys(checks).length) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }

  return {
    status,
    checks,
    timestamp: new Date().toISOString(),
  };
}

app.get('/health', async (req, res) => {
  const health = await checkHealth();

  const statusCode = {
    healthy: 200,
    degraded: 200, // Still accepts traffic
    unhealthy: 503,
  }[health.status];

  res.status(statusCode).json(health);
});
```

### Response Example

```json
{
  "status": "healthy",
  "checks": {
    "bus": { "status": "healthy" },
    "database": { "status": "healthy", "latency": 5 },
    "transport": { "status": "healthy", "latency": 12 }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Built-in Health Routes

### Express Integration

```typescript
import { createHealthRoutes } from '@saga-bus/express';

const healthRoutes = createHealthRoutes(bus, {
  store,
  transport,
  additionalChecks: {
    'external-api': async () => {
      const response = await fetch('https://api.example.com/health');
      return response.ok;
    },
  },
});

app.use('/health', healthRoutes);
```

### Fastify Integration

```typescript
import { createHealthPlugin } from '@saga-bus/fastify';

await fastify.register(createHealthPlugin, {
  bus,
  store,
  transport,
});

// Routes:
// GET /health/live
// GET /health/ready
// GET /health (detailed)
```

## Kubernetes Configuration

### Pod Spec

```yaml
spec:
  containers:
    - name: saga-worker
      livenessProbe:
        httpGet:
          path: /health/live
          port: 3000
        initialDelaySeconds: 10
        periodSeconds: 10
        timeoutSeconds: 5
        failureThreshold: 3
      readinessProbe:
        httpGet:
          path: /health/ready
          port: 3000
        initialDelaySeconds: 5
        periodSeconds: 5
        timeoutSeconds: 3
        failureThreshold: 3
      startupProbe:
        httpGet:
          path: /health/live
          port: 3000
        initialDelaySeconds: 0
        periodSeconds: 2
        failureThreshold: 30
```

### Startup Probe

Use startup probes for slow-starting applications:

```yaml
startupProbe:
  httpGet:
    path: /health/live
    port: 3000
  failureThreshold: 30
  periodSeconds: 2
```

## Docker Health Checks

### Dockerfile

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health/live || exit 1
```

### Docker Compose

```yaml
services:
  saga-worker:
    build: .
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health/live"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

## AWS Health Checks

### ECS

```json
{
  "healthCheck": {
    "command": [
      "CMD-SHELL",
      "curl -f http://localhost:3000/health/live || exit 1"
    ],
    "interval": 30,
    "timeout": 5,
    "retries": 3,
    "startPeriod": 60
  }
}
```

### Application Load Balancer

```hcl
resource "aws_lb_target_group" "saga_worker" {
  name     = "saga-worker"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    enabled             = true
    path                = "/health/ready"
    port                = "traffic-port"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }
}
```

## Deep Health Checks

### Database Query Test

```typescript
async function checkDatabaseHealth(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    // Test actual query capability
    await pool.query('SELECT 1 as health_check');

    // Check connection pool
    const poolInfo = {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    };

    return {
      status: 'healthy',
      latency: Date.now() - start,
      details: poolInfo,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message,
    };
  }
}
```

### Transport Connection Test

```typescript
async function checkTransportHealth(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    // Verify connection is established
    const isConnected = await transport.isConnected();

    if (!isConnected) {
      return {
        status: 'unhealthy',
        message: 'Transport disconnected',
      };
    }

    // Check queue depth (optional)
    const queueDepth = await transport.getQueueDepth();

    return {
      status: 'healthy',
      latency: Date.now() - start,
      details: { queueDepth },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message,
    };
  }
}
```

## Circuit Breaker Pattern

```typescript
import CircuitBreaker from 'opossum';

const healthCheckBreaker = new CircuitBreaker(checkHealth, {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});

app.get('/health', async (req, res) => {
  try {
    const health = await healthCheckBreaker.fire();
    res.json(health);
  } catch (error) {
    // Circuit is open
    res.status(503).json({
      status: 'unhealthy',
      message: 'Health check circuit open',
      timestamp: new Date().toISOString(),
    });
  }
});
```

## Metrics from Health Checks

```typescript
import { Counter, Histogram } from 'prom-client';

const healthCheckDuration = new Histogram({
  name: 'health_check_duration_seconds',
  help: 'Duration of health checks',
  labelNames: ['check'],
});

const healthCheckStatus = new Counter({
  name: 'health_check_total',
  help: 'Health check results',
  labelNames: ['check', 'status'],
});

async function instrumentedHealthCheck() {
  const checks = ['database', 'transport', 'bus'];

  for (const check of checks) {
    const end = healthCheckDuration.startTimer({ check });
    const result = await performCheck(check);
    end();

    healthCheckStatus.inc({ check, status: result.status });
  }
}
```

## Best Practices

1. **Keep liveness probes simple** - They should never fail unless the process is truly dead
2. **Use appropriate timeouts** - Don't let health checks hang
3. **Cache expensive checks** - Don't overwhelm dependencies
4. **Include latency metrics** - Track check performance
5. **Use startup probes** - Allow time for initialization
6. **Return meaningful status codes** - 200 for healthy, 503 for unhealthy

## See Also

- [Deployment](/docs/production/deployment)
- [Observability](/docs/production/observability)
- [Error Recovery](/docs/production/error-recovery)
