# @saga-bus/transport-redis

Redis Streams transport for saga-bus using ioredis.

## Features

- **Redis Streams** - Uses XADD/XREADGROUP for reliable message delivery
- **Consumer Groups** - Competing consumers with automatic load balancing
- **Message Acknowledgment** - Manual XACK after successful processing
- **Delayed Messages** - Sorted set-based delayed delivery (ZADD/ZRANGEBYSCORE)
- **Pending Recovery** - Automatic claiming of unacknowledged messages (XCLAIM)
- **Stream Trimming** - Configurable MAXLEN for memory management

## Installation

```bash
npm install @saga-bus/transport-redis ioredis
# or
pnpm add @saga-bus/transport-redis ioredis
```

## Usage

### Basic Setup

```typescript
import Redis from "ioredis";
import { RedisTransport } from "@saga-bus/transport-redis";

const redis = new Redis({
  host: "localhost",
  port: 6379,
});

const transport = new RedisTransport({
  redis,
  consumerGroup: "order-processor",
});

await transport.start();
```

### With Connection Options

```typescript
import { RedisTransport } from "@saga-bus/transport-redis";

const transport = new RedisTransport({
  connection: {
    host: "localhost",
    port: 6379,
    password: "secret",
    db: 0,
  },
  consumerGroup: "order-processor",
});
```

### Publishing Messages

```typescript
interface OrderCreated {
  type: "OrderCreated";
  orderId: string;
  amount: number;
}

// Immediate delivery
await transport.publish<OrderCreated>(
  { type: "OrderCreated", orderId: "123", amount: 99.99 },
  { endpoint: "orders" }
);

// With partition key (for ordering)
await transport.publish<OrderCreated>(
  { type: "OrderCreated", orderId: "123", amount: 99.99 },
  { endpoint: "orders", key: "customer-456" }
);

// Delayed delivery (5 minutes)
await transport.publish<OrderCreated>(
  { type: "OrderCreated", orderId: "123", amount: 99.99 },
  { endpoint: "orders", delayMs: 5 * 60 * 1000 }
);
```

### Subscribing to Messages

```typescript
await transport.subscribe(
  { endpoint: "orders", concurrency: 5 },
  async (envelope) => {
    console.log("Received:", envelope.type, envelope.payload);
    // Message is automatically acknowledged after successful processing
  }
);

await transport.start();
```

### With saga-bus

```typescript
import { createBus } from "@saga-bus/core";
import { RedisTransport } from "@saga-bus/transport-redis";
import Redis from "ioredis";

const bus = createBus({
  transport: new RedisTransport({
    redis: new Redis(),
    consumerGroup: "my-app",
  }),
  // ... other config
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `redis` | `Redis` | - | ioredis client instance |
| `connection` | `RedisOptions` | - | Connection options (alternative to `redis`) |
| `keyPrefix` | `string` | `"saga-bus:"` | Prefix for all Redis keys |
| `consumerGroup` | `string` | - | Consumer group name (required for subscribing) |
| `consumerName` | `string` | Auto UUID | Consumer name within the group |
| `autoCreateGroup` | `boolean` | `true` | Create consumer groups automatically |
| `batchSize` | `number` | `10` | Messages to fetch per read |
| `blockTimeoutMs` | `number` | `5000` | Block timeout for XREADGROUP |
| `maxStreamLength` | `number` | `0` | Max stream length (0 = unlimited) |
| `approximateMaxLen` | `boolean` | `true` | Use approximate MAXLEN (~) |
| `delayedPollIntervalMs` | `number` | `1000` | How often to check delayed messages |
| `delayedSetKey` | `string` | `"saga-bus:delayed"` | Key for delayed messages sorted set |
| `pendingClaimIntervalMs` | `number` | `30000` | How often to claim pending messages |
| `minIdleTimeMs` | `number` | `60000` | Min idle time before claiming |

## Redis Data Structures

### Streams

Messages are stored in Redis Streams with key pattern:
```
{keyPrefix}stream:{endpoint}
```

Example: `saga-bus:stream:orders`

Each message contains:
```
data: <JSON envelope>
```

### Delayed Messages

Delayed messages use a sorted set:
```
{delayedSetKey}
```

Score: Unix timestamp (ms) when message should be delivered
Value: JSON with `{ streamKey, envelope, deliverAt }`

## Error Handling

- Failed messages are NOT acknowledged, allowing retry via pending recovery
- Pending messages older than `minIdleTimeMs` are claimed by active consumers
- Consumer group creation ignores "BUSYGROUP" errors (already exists)

## Performance Tips

1. **Batch Size**: Increase `batchSize` for high-throughput scenarios
2. **Stream Trimming**: Set `maxStreamLength` to prevent unbounded growth
3. **Approximate MAXLEN**: Keep `approximateMaxLen: true` for better performance
4. **Connection Pooling**: Pass a shared Redis client for connection reuse

## License

MIT
