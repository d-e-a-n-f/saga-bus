---
sidebar_position: 2
title: Health Checks
---

# Health Checks

Coming soon.

## Liveness vs Readiness

- **Liveness**: Is the process alive?
- **Readiness**: Can it accept traffic?

## Implementation

```typescript
app.get('/health/live', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health/ready', async (req, res) => {
  const isReady = bus.isRunning();
  res.status(isReady ? 200 : 503).json({ ready: isReady });
});
```
