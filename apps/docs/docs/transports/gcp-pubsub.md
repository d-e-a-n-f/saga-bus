---
sidebar_position: 7
title: GCP Pub/Sub
---

# GCP Pub/Sub Transport

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/transport-gcp-pubsub @google-cloud/pubsub
```

## Basic Usage

```typescript
import { GcpPubSubTransport } from '@saga-bus/transport-gcp-pubsub';

const transport = new GcpPubSubTransport({
  projectId: 'my-project',
});
```
