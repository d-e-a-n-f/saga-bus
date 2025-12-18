---
"@saga-bus/core": patch
"@saga-bus/test": patch
"@saga-bus/transport-inmemory": patch
"@saga-bus/transport-rabbitmq": patch
"@saga-bus/transport-kafka": patch
"@saga-bus/transport-sqs": patch
"@saga-bus/transport-azure-servicebus": patch
"@saga-bus/transport-gcp-pubsub": patch
"@saga-bus/transport-redis": patch
"@saga-bus/transport-nats": patch
"@saga-bus/store-inmemory": patch
"@saga-bus/store-postgres": patch
"@saga-bus/store-mysql": patch
"@saga-bus/store-sqlserver": patch
"@saga-bus/store-mongo": patch
"@saga-bus/store-dynamodb": patch
"@saga-bus/store-redis": patch
"@saga-bus/store-prisma": patch
"@saga-bus/middleware-logging": patch
"@saga-bus/middleware-tracing": patch
"@saga-bus/middleware-metrics": patch
"@saga-bus/middleware-validation": patch
"@saga-bus/middleware-idempotency": patch
"@saga-bus/middleware-tenant": patch
"@saga-bus/nestjs": patch
"@saga-bus/nextjs": patch
"@saga-bus/express": patch
"@saga-bus/fastify": patch
"@saga-bus/hono": patch
---

Fix npm publish rate limiting by using sequential publish script. Republish packages that failed due to E429 rate limit error.
