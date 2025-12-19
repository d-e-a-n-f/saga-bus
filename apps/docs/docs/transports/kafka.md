---
sidebar_position: 4
title: Kafka
---

# Kafka Transport

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/transport-kafka kafkajs
```

## Basic Usage

```typescript
import { KafkaTransport } from '@saga-bus/transport-kafka';

const transport = new KafkaTransport({
  brokers: ['localhost:9092'],
  clientId: 'my-app',
});
```
