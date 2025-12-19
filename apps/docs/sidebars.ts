import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/installation',
        'getting-started/quick-start',
        'getting-started/your-first-saga',
        'getting-started/project-structure',
      ],
    },
    {
      type: 'category',
      label: 'Core Concepts',
      items: [
        'core-concepts/overview',
        'core-concepts/messages',
        'core-concepts/sagas',
        'core-concepts/correlation',
        'core-concepts/state-management',
        'core-concepts/timeouts',
        'core-concepts/error-handling',
        'core-concepts/distributed-tracing',
      ],
    },
    {
      type: 'category',
      label: 'DSL Reference',
      items: [
        'dsl-reference/overview',
        'dsl-reference/builder-methods',
        'dsl-reference/handlers',
        'dsl-reference/context-api',
        'dsl-reference/typescript-tips',
      ],
    },
    {
      type: 'category',
      label: 'Transports',
      items: [
        'transports/overview',
        'transports/inmemory',
        'transports/rabbitmq',
        'transports/kafka',
        'transports/sqs',
        'transports/azure-servicebus',
        'transports/gcp-pubsub',
        'transports/redis',
        'transports/nats',
      ],
    },
    {
      type: 'category',
      label: 'Stores',
      items: [
        'stores/overview',
        'stores/inmemory',
        'stores/postgres',
        'stores/mysql',
        'stores/sqlserver',
        'stores/mongodb',
        'stores/dynamodb',
        'stores/redis',
        'stores/sqlite',
        'stores/prisma',
      ],
    },
    {
      type: 'category',
      label: 'Middleware',
      items: [
        'middleware/overview',
        'middleware/logging',
        'middleware/tracing',
        'middleware/metrics',
        'middleware/validation',
        'middleware/idempotency',
        'middleware/tenant',
        'middleware/custom-middleware',
      ],
    },
    {
      type: 'category',
      label: 'Framework Integrations',
      items: [
        'framework-integrations/overview',
        'framework-integrations/nestjs',
        'framework-integrations/nextjs',
        'framework-integrations/express',
        'framework-integrations/fastify',
        'framework-integrations/hono',
      ],
    },
    {
      type: 'category',
      label: 'Testing',
      items: [
        'testing/overview',
        'testing/test-harness',
        'testing/unit-testing',
        'testing/integration-testing',
        'testing/mocking',
      ],
    },
    {
      type: 'category',
      label: 'Production',
      items: [
        'production/deployment',
        'production/health-checks',
        'production/observability',
        'production/scaling',
        'production/error-recovery',
        'production/security',
      ],
    },
    {
      type: 'category',
      label: 'Examples',
      items: [
        'examples/overview',
        'examples/order-saga',
        'examples/loan-application',
        'examples/patterns',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/core',
        'api/types',
        'api/errors',
      ],
    },
  ],
};

export default sidebars;
