---
sidebar_position: 5
title: SQL Server
---

# SQL Server Store

Enterprise store using Microsoft SQL Server with JSON support.

## Installation

```bash npm2yarn
npm install @saga-bus/store-sqlserver mssql
```

## Basic Usage

```typescript
import { SqlServerSagaStore } from '@saga-bus/store-sqlserver';

const store = new SqlServerSagaStore({
  connectionString: process.env.MSSQL_URL,
});

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
});

await bus.start();
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `connectionString` | `string` | - | SQL Server connection string |
| `server` | `string` | Required | Server hostname |
| `database` | `string` | Required | Database name |
| `user` | `string` | - | SQL authentication user |
| `password` | `string` | - | SQL authentication password |
| `pool` | `ConnectionPool` | - | Existing mssql pool |
| `tableName` | `string` | `'sagas'` | Table name |
| `schema` | `string` | `'dbo'` | Schema name |

## Full Configuration Example

```typescript
import { SqlServerSagaStore, createSchema } from '@saga-bus/store-sqlserver';
import sql from 'mssql';

// Option 1: Connection string
const store = new SqlServerSagaStore({
  connectionString: 'Server=localhost;Database=sagas;User Id=sa;Password=YourStrong!Passw0rd;TrustServerCertificate=true',
});

// Option 2: Individual settings
const store = new SqlServerSagaStore({
  server: 'localhost',
  database: 'sagas',
  user: 'sa',
  password: 'YourStrong!Passw0rd',
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
});

// Option 3: Windows Authentication
const store = new SqlServerSagaStore({
  server: 'localhost',
  database: 'sagas',
  options: {
    trustedConnection: true,
  },
});

// Option 4: Existing pool
const pool = await sql.connect({
  server: 'localhost',
  database: 'sagas',
  user: 'sa',
  password: 'YourStrong!Passw0rd',
  pool: {
    max: 20,
    min: 5,
    idleTimeoutMillis: 30000,
  },
});

const store = new SqlServerSagaStore({ pool });
```

## Schema Setup

### Automatic

```typescript
import { createSchema } from '@saga-bus/store-sqlserver';
import sql from 'mssql';

const pool = await sql.connect(process.env.MSSQL_URL);
await createSchema(pool);
```

### Manual Migration

```typescript
import { getSchemaSql } from '@saga-bus/store-sqlserver';

const ddl = getSchemaSql();
// Add to your migration tool
```

### SQL Schema

```sql
CREATE TABLE [dbo].[sagas] (
  [saga_name] NVARCHAR(255) NOT NULL,
  [saga_id] UNIQUEIDENTIFIER NOT NULL,
  [correlation_id] NVARCHAR(255) NOT NULL,
  [version] INT NOT NULL DEFAULT 1,
  [state] NVARCHAR(MAX) NOT NULL,
  [is_completed] BIT NOT NULL DEFAULT 0,
  [created_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  [updated_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  CONSTRAINT [PK_sagas] PRIMARY KEY CLUSTERED ([saga_name], [saga_id])
);

CREATE NONCLUSTERED INDEX [IX_sagas_correlation]
ON [dbo].[sagas] ([saga_name], [correlation_id]);

CREATE NONCLUSTERED INDEX [IX_sagas_completed]
ON [dbo].[sagas] ([saga_name], [is_completed]);
```

## Azure SQL Database

For Azure SQL:

```typescript
const store = new SqlServerSagaStore({
  server: 'myserver.database.windows.net',
  database: 'sagas',
  authentication: {
    type: 'azure-active-directory-default',
  },
  options: {
    encrypt: true,
  },
});
```

With Managed Identity:

```typescript
import { DefaultAzureCredential } from '@azure/identity';

const store = new SqlServerSagaStore({
  server: 'myserver.database.windows.net',
  database: 'sagas',
  authentication: {
    type: 'azure-active-directory-msi-app-service',
  },
});
```

## Docker Setup

```yaml
# docker-compose.yml
services:
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: Y
      MSSQL_SA_PASSWORD: YourStrong!Passw0rd
    ports:
      - "1433:1433"
```

## Connection Pooling

Configure pool settings:

```typescript
import sql from 'mssql';

const pool = await sql.connect({
  server: 'localhost',
  database: 'sagas',
  user: 'sa',
  password: 'YourStrong!Passw0rd',
  pool: {
    max: 20,
    min: 5,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
});

const store = new SqlServerSagaStore({ pool });
```

## Optimistic Concurrency

SQL Server's ROWVERSION for conflict detection:

```typescript
// Built-in optimistic locking via version column
// Throws ConcurrencyError on version mismatch
```

## Best Practices

### Use NVARCHAR for Unicode

```sql
-- Full Unicode support
[saga_name] NVARCHAR(255)
[state] NVARCHAR(MAX)
```

### Configure Appropriate Indexes

```sql
-- Clustered primary key
CONSTRAINT [PK_sagas] PRIMARY KEY CLUSTERED ([saga_name], [saga_id])

-- Non-clustered for queries
CREATE NONCLUSTERED INDEX [IX_sagas_correlation]
```

### Enable Read Committed Snapshot

```sql
ALTER DATABASE sagas SET READ_COMMITTED_SNAPSHOT ON;
```

## See Also

- [Stores Overview](/docs/stores/overview)
- [Azure Service Bus Transport](/docs/transports/azure-servicebus)
- [Deployment](/docs/production/deployment)
