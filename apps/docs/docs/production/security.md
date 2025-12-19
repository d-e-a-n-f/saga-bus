---
sidebar_position: 6
title: Security
---

# Security

Secure saga-bus applications with authentication, authorization, and encryption.

## Message Authentication

### Signing Messages

```typescript
import { createSigningMiddleware } from '@saga-bus/middleware-security';
import crypto from 'crypto';

const signingMiddleware = createSigningMiddleware({
  algorithm: 'sha256',
  secret: process.env.MESSAGE_SIGNING_SECRET,
  headerName: 'x-saga-signature',
});

const bus = createBus({
  transport,
  store,
  middleware: [signingMiddleware],
});

// Messages are automatically signed on publish
await bus.publish({
  type: 'OrderSubmitted',
  orderId: '123',
});
// Header added: x-saga-signature: sha256=abc123...
```

### HMAC Implementation

```typescript
function signMessage(message: object, secret: string): string {
  const payload = JSON.stringify(message);
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

function verifySignature(
  message: object,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = signMessage(message, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Verification middleware
const verifyMiddleware = createMiddleware({
  name: 'verify-signature',
  beforeHandle: async ({ message, metadata }) => {
    const signature = metadata.get('x-saga-signature');

    if (!signature) {
      throw new SecurityError('Missing message signature');
    }

    if (!verifySignature(message, signature, process.env.MESSAGE_SIGNING_SECRET)) {
      throw new SecurityError('Invalid message signature');
    }
  },
});
```

### JWT Message Tokens

```typescript
import jwt from 'jsonwebtoken';

const jwtMiddleware = createMiddleware({
  name: 'jwt-auth',
  beforePublish: async ({ message }) => {
    const token = jwt.sign(
      {
        messageType: message.type,
        timestamp: Date.now(),
        nonce: crypto.randomUUID(),
      },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    return {
      ...message,
      __authToken: token,
    };
  },
  beforeHandle: async ({ message }) => {
    try {
      jwt.verify(message.__authToken, process.env.JWT_SECRET);
    } catch (error) {
      throw new SecurityError('Invalid or expired message token');
    }
  },
});
```

## Authorization

### Role-Based Access Control

```typescript
interface AuthContext {
  userId: string;
  roles: string[];
  permissions: string[];
}

const authorizationMiddleware = createMiddleware({
  name: 'authorization',
  beforeHandle: async ({ message, context }) => {
    const auth = context.metadata.get('auth') as AuthContext;

    // Check message-level permissions
    const requiredPermission = getRequiredPermission(message.type);

    if (!auth.permissions.includes(requiredPermission)) {
      throw new AuthorizationError(
        `Missing permission: ${requiredPermission}`
      );
    }
  },
});

function getRequiredPermission(messageType: string): string {
  const permissions: Record<string, string> = {
    'OrderSubmitted': 'orders:create',
    'OrderCancelled': 'orders:cancel',
    'RefundRequested': 'payments:refund',
  };
  return permissions[messageType] || 'default';
}
```

### Saga-Level Authorization

```typescript
const orderSaga = defineSaga({
  name: 'OrderSaga',
  authorize: async (ctx) => {
    const auth = ctx.metadata.get('auth');

    // Only allow order owner or admins
    if (ctx.state.customerId !== auth.userId && !auth.roles.includes('admin')) {
      throw new AuthorizationError('Not authorized to access this order');
    }
  },
  handlers: {
    // ...
  },
});
```

### Tenant Isolation

```typescript
const tenantMiddleware = createMiddleware({
  name: 'tenant-isolation',
  beforeHandle: async ({ message, context }) => {
    const tenantId = context.metadata.get('tenantId');

    // Verify message belongs to tenant
    if (message.tenantId && message.tenantId !== tenantId) {
      throw new SecurityError('Cross-tenant access denied');
    }
  },
  beforeStore: async ({ sagaName, correlationId, state, context }) => {
    // Add tenant scope to store queries
    return {
      ...state,
      __tenantId: context.metadata.get('tenantId'),
    };
  },
});
```

## Encryption

### Message Encryption

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

function encrypt(data: object): EncryptedPayload {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);

  const plaintext = JSON.stringify(data);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    iv: iv.toString('hex'),
    data: encrypted,
    authTag: cipher.getAuthTag().toString('hex'),
  };
}

function decrypt(payload: EncryptedPayload): object {
  const decipher = createDecipheriv(
    ALGORITHM,
    KEY,
    Buffer.from(payload.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));

  let decrypted = decipher.update(payload.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}
```

### Field-Level Encryption

```typescript
const sensitiveFields = ['creditCard', 'ssn', 'password'];

const fieldEncryptionMiddleware = createMiddleware({
  name: 'field-encryption',
  beforePublish: async ({ message }) => {
    const encrypted = { ...message };

    for (const field of sensitiveFields) {
      if (encrypted[field]) {
        encrypted[field] = encrypt({ value: encrypted[field] });
        encrypted[`__encrypted_${field}`] = true;
      }
    }

    return encrypted;
  },
  beforeHandle: async ({ message }) => {
    const decrypted = { ...message };

    for (const field of sensitiveFields) {
      if (decrypted[`__encrypted_${field}`]) {
        decrypted[field] = decrypt(decrypted[field]).value;
        delete decrypted[`__encrypted_${field}`];
      }
    }

    return decrypted;
  },
});
```

### At-Rest Encryption

```typescript
// PostgreSQL with encrypted columns
const store = new PostgresSagaStore({
  pool,
  encryption: {
    enabled: true,
    columns: ['state'], // Encrypt state column
    key: process.env.DB_ENCRYPTION_KEY,
  },
});

// Or use database-level encryption
// PostgreSQL: pgcrypto extension
// MySQL: AES_ENCRYPT/AES_DECRYPT
// SQL Server: Always Encrypted
```

## Transport Security

### TLS Configuration

```typescript
// RabbitMQ with TLS
const transport = new RabbitMQTransport({
  url: 'amqps://user:pass@rabbitmq.example.com:5671',
  tls: {
    ca: fs.readFileSync('/path/to/ca.pem'),
    cert: fs.readFileSync('/path/to/client-cert.pem'),
    key: fs.readFileSync('/path/to/client-key.pem'),
    rejectUnauthorized: true,
  },
});

// Kafka with TLS
const transport = new KafkaTransport({
  brokers: ['kafka.example.com:9093'],
  ssl: {
    ca: [fs.readFileSync('/path/to/ca.pem')],
    key: fs.readFileSync('/path/to/client-key.pem'),
    cert: fs.readFileSync('/path/to/client-cert.pem'),
  },
});
```

### SASL Authentication

```typescript
// Kafka SASL
const transport = new KafkaTransport({
  brokers: ['kafka.example.com:9093'],
  ssl: true,
  sasl: {
    mechanism: 'scram-sha-512',
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },
});
```

## Secrets Management

### Environment Variables

```typescript
// Never hardcode secrets
// Bad
const secret = 'my-secret-key';

// Good
const secret = process.env.SECRET_KEY;

// Validate at startup
if (!process.env.SECRET_KEY) {
  throw new Error('SECRET_KEY environment variable required');
}
```

### AWS Secrets Manager

```typescript
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

const secretsManager = new SecretsManager();

async function getSecret(secretName: string): Promise<string> {
  const response = await secretsManager.getSecretValue({
    SecretId: secretName,
  });
  return response.SecretString!;
}

// Usage
const dbPassword = await getSecret('saga-bus/db-password');
```

### HashiCorp Vault

```typescript
import Vault from 'node-vault';

const vault = Vault({
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN,
});

async function getSecret(path: string): Promise<Record<string, string>> {
  const response = await vault.read(path);
  return response.data.data;
}

// Usage
const secrets = await getSecret('secret/data/saga-bus');
const dbUrl = secrets.DATABASE_URL;
```

## Input Validation

### Schema Validation

```typescript
import { z } from 'zod';

const OrderSubmittedSchema = z.object({
  type: z.literal('OrderSubmitted'),
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
  })).min(1),
  total: z.number().positive(),
});

const validationMiddleware = createMiddleware({
  name: 'validation',
  beforeHandle: async ({ message }) => {
    const schema = getSchemaForMessage(message.type);
    if (schema) {
      schema.parse(message); // Throws on invalid
    }
  },
});
```

### Sanitization

```typescript
import DOMPurify from 'isomorphic-dompurify';

const sanitizationMiddleware = createMiddleware({
  name: 'sanitization',
  beforeHandle: async ({ message }) => {
    return sanitizeObject(message);
  },
});

function sanitizeObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return DOMPurify.sanitize(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  if (obj && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  return obj;
}
```

## Audit Logging

```typescript
const auditMiddleware = createMiddleware({
  name: 'audit',
  afterHandle: async ({ message, context, result }) => {
    await auditLog.write({
      timestamp: new Date().toISOString(),
      event: 'message_processed',
      messageType: message.type,
      correlationId: context.correlationId,
      sagaName: context.sagaName,
      userId: context.metadata.get('userId'),
      tenantId: context.metadata.get('tenantId'),
      sourceIp: context.metadata.get('sourceIp'),
      success: !result.error,
      duration: result.duration,
    });
  },
  onError: async ({ error, message, context }) => {
    await auditLog.write({
      timestamp: new Date().toISOString(),
      event: 'message_failed',
      messageType: message.type,
      correlationId: context.correlationId,
      error: error.message,
      userId: context.metadata.get('userId'),
    });
  },
});
```

## Rate Limiting

```typescript
import { RateLimiter } from '@saga-bus/middleware-ratelimit';

const rateLimiter = new RateLimiter({
  points: 100,        // 100 requests
  duration: 60,       // Per minute
  keyGenerator: (ctx) => ctx.metadata.get('userId') || ctx.metadata.get('ip'),
  onLimit: async (ctx) => {
    throw new RateLimitError('Too many requests');
  },
});

const bus = createBus({
  middleware: [rateLimiter.middleware()],
});
```

## Security Headers

```typescript
// For HTTP-triggered sagas
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});
```

## Best Practices

1. **Never trust input** - Validate and sanitize all messages
2. **Encrypt sensitive data** - Both in transit and at rest
3. **Use least privilege** - Minimal permissions for service accounts
4. **Rotate secrets regularly** - Use automated rotation
5. **Audit everything** - Log security-relevant events
6. **Defense in depth** - Multiple layers of security
7. **Keep dependencies updated** - Patch vulnerabilities promptly

## Security Checklist

- [ ] TLS enabled for all transport connections
- [ ] Message signatures verified
- [ ] Sensitive fields encrypted
- [ ] Input validation on all handlers
- [ ] Role-based access control implemented
- [ ] Audit logging enabled
- [ ] Secrets stored securely (not in code)
- [ ] Rate limiting configured
- [ ] Tenant isolation enforced
- [ ] Dependencies scanned for vulnerabilities

## See Also

- [Validation Middleware](/docs/middleware/validation)
- [Multi-Tenant Middleware](/docs/middleware/tenant)
- [Deployment](/docs/production/deployment)
