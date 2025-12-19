---
sidebar_position: 6
title: Azure Service Bus
---

# Azure Service Bus Transport

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/transport-azure-servicebus @azure/service-bus
```

## Basic Usage

```typescript
import { AzureServiceBusTransport } from '@saga-bus/transport-azure-servicebus';

const transport = new AzureServiceBusTransport({
  connectionString: process.env.AZURE_SERVICEBUS_CONNECTION_STRING,
});
```
