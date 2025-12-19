import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import { LiveSagaEditor } from '../components/Flow';

import styles from './index.module.css';

function HeroSection() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={styles.hero}>
      <div className={styles.heroBackground} />
      <div className={styles.heroContent}>
        <div className={styles.heroLabel}>Open Source Saga Orchestration</div>
        <Heading as="h1" className={styles.heroTitle}>
          Build Reliable Distributed<br />
          <span className={styles.heroHighlight}>Workflows in TypeScript</span>
        </Heading>
        <p className={styles.heroSubtitle}>
          MassTransit-style saga orchestration for Node.js. Type-safe DSL,
          multiple message brokers, built-in observability.
        </p>
        <div className={styles.heroButtons}>
          <Link className={styles.primaryButton} to="/docs/getting-started/quick-start">
            Get Started
          </Link>
          <Link className={styles.secondaryButton} to="#try-it">
            Try the Playground
          </Link>
          <Link className={styles.githubButton} to="https://github.com/d-e-a-n-f/saga-bus">
            <GitHubIcon /> GitHub
          </Link>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>10+</span>
            <span className={styles.statLabel}>Transports</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>8+</span>
            <span className={styles.statLabel}>Stores</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>100%</span>
            <span className={styles.statLabel}>TypeScript</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

function PlaygroundSection() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const simpleExample = `// Define your message types
type OrderSubmitted = { type: 'OrderSubmitted'; orderId: string };
type PaymentCaptured = { type: 'PaymentCaptured'; orderId: string };
type PaymentFailed = { type: 'PaymentFailed'; orderId: string };
type ShipmentCreated = { type: 'ShipmentCreated'; orderId: string };
type Shipped = { type: 'Shipped'; orderId: string };

type OrderMessages = OrderSubmitted | PaymentCaptured | PaymentFailed | ShipmentCreated | Shipped;

// Define your saga state
interface OrderState {
  orderId: string;
  status: 'pending' | 'paid' | 'shipped' | 'completed' | 'failed';
}

// Build your saga with the fluent DSL
const orderSaga = createSagaMachine<OrderState, OrderMessages>()
  .name('OrderSaga')
  .correlate('OrderSubmitted', msg => msg.orderId, { canStart: true })
  .correlate('*', msg => msg.orderId)

  .initial<OrderSubmitted>(msg => ({
    orderId: msg.orderId,
    status: 'pending',
  }))

  .on('PaymentCaptured')
    .when(state => state.status === 'pending')
    .handle(async (msg, state) => ({
      ...state,
      status: 'paid',
    }))

  .on('PaymentFailed')
    .when(state => state.status === 'pending')
    .handle(async (msg, state, ctx) => {
      ctx.complete();
      return { ...state, status: 'failed' };
    })

  .on('ShipmentCreated')
    .when(state => state.status === 'paid')
    .handle(async (msg, state) => ({
      ...state,
      status: 'shipped',
    }))

  .on('Shipped')
    .when(state => state.status === 'shipped')
    .handle(async (msg, state, ctx) => {
      ctx.complete();
      return { ...state, status: 'completed' };
    })

  .build();
`;

  return (
    <section id="try-it" className={styles.playgroundSection}>
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionLabel}>Interactive</div>
          <Heading as="h2" className={styles.sectionTitle}>
            Try It Right Now
          </Heading>
          <p className={styles.sectionSubtitle}>
            Edit the saga definition below and watch the state machine diagram update in real-time.
            No setup required.
          </p>
        </div>
        {isClient && (
          <div className={styles.playgroundWrapper}>
            <LiveSagaEditor
              initialDefinition={simpleExample}
              height={550}
              title="Order Processing Saga"
            />
          </div>
        )}
        <div className={styles.playgroundCta}>
          <Link className={styles.primaryButton} to="/docs/examples/playground">
            Open Full Playground
          </Link>
        </div>
      </div>
    </section>
  );
}

const features = [
  {
    icon: '🔷',
    title: 'Type-Safe DSL',
    description: 'Fluent builder API with full TypeScript inference. Catch errors at compile time, not runtime.',
  },
  {
    icon: '🔌',
    title: '10+ Transports',
    description: 'RabbitMQ, Kafka, SQS, Azure Service Bus, GCP Pub/Sub, Redis, NATS, and in-memory for testing.',
  },
  {
    icon: '💾',
    title: '8+ Stores',
    description: 'PostgreSQL, MySQL, MongoDB, DynamoDB, Redis, SQLite, SQL Server, and in-memory.',
  },
  {
    icon: '📊',
    title: 'Observability',
    description: 'Built-in OpenTelemetry tracing, Prometheus metrics, and structured logging middleware.',
  },
  {
    icon: '🔄',
    title: 'Compensation',
    description: 'Handle failures gracefully with built-in compensation patterns and retry policies.',
  },
  {
    icon: '⚡',
    title: 'Framework Agnostic',
    description: 'Works with Express, Fastify, NestJS, Next.js, Hono, or standalone Node.js.',
  },
];

function FeaturesSection() {
  return (
    <section className={styles.featuresSection}>
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionLabel}>Why Saga Bus?</div>
          <Heading as="h2" className={styles.sectionTitle}>
            Everything You Need for<br />Distributed Workflows
          </Heading>
        </div>
        <div className={styles.featuresGrid}>
          {features.map((feature, idx) => (
            <div key={idx} className={styles.featureCard}>
              <div className={styles.featureIcon}>{feature.icon}</div>
              <Heading as="h3" className={styles.featureTitle}>{feature.title}</Heading>
              <p className={styles.featureDescription}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CodePreviewSection() {
  return (
    <section className={styles.codeSection}>
      <div className={styles.container}>
        <div className={styles.codeLayout}>
          <div className={styles.codeContent}>
            <div className={styles.sectionLabel}>Simple Setup</div>
            <Heading as="h2" className={styles.sectionTitle}>
              Up and Running<br />in Minutes
            </Heading>
            <p className={styles.sectionSubtitle}>
              Install the packages, define your saga, wire up your transport and store. That's it.
            </p>
            <div className={styles.codeSteps}>
              <div className={styles.codeStep}>
                <span className={styles.stepNumber}>1</span>
                <span>Install packages</span>
              </div>
              <div className={styles.codeStep}>
                <span className={styles.stepNumber}>2</span>
                <span>Define saga with DSL</span>
              </div>
              <div className={styles.codeStep}>
                <span className={styles.stepNumber}>3</span>
                <span>Start the bus</span>
              </div>
            </div>
            <Link className={styles.primaryButton} to="/docs/getting-started/quick-start">
              Read the Quick Start Guide
            </Link>
          </div>
          <div className={styles.codeBlock}>
            <div className={styles.codeHeader}>
              <span className={styles.codeDot} />
              <span className={styles.codeDot} />
              <span className={styles.codeDot} />
              <span className={styles.codeFilename}>worker.ts</span>
            </div>
            <pre>
              <code>{`import { createBus } from '@saga-bus/core';
import { RabbitMQTransport } from '@saga-bus/transport-rabbitmq';
import { PostgresSagaStore } from '@saga-bus/store-postgres';
import { orderSaga } from './sagas/order';

const bus = createBus({
  transport: new RabbitMQTransport({
    url: process.env.RABBITMQ_URL,
  }),
  store: new PostgresSagaStore({
    connectionString: process.env.DATABASE_URL,
  }),
  sagas: [{ definition: orderSaga }],
});

await bus.start();
console.log('🚀 Saga worker running');`}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className={styles.ctaSection}>
      <div className={styles.container}>
        <Heading as="h2" className={styles.ctaTitle}>
          Ready to Build Reliable Workflows?
        </Heading>
        <p className={styles.ctaSubtitle}>
          Join developers building production-grade distributed systems with Saga Bus.
        </p>
        <div className={styles.ctaButtons}>
          <Link className={styles.primaryButton} to="/docs/getting-started/quick-start">
            Get Started Now
          </Link>
          <Link className={styles.secondaryButton} to="/docs/examples/order-saga">
            View Examples
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title="Saga Orchestration for TypeScript"
      description="MassTransit-style saga orchestration for TypeScript/Node.js. Type-safe DSL, multiple message brokers, built-in observability.">
      <HeroSection />
      <main>
        <PlaygroundSection />
        <FeaturesSection />
        <CodePreviewSection />
        <CtaSection />
      </main>
    </Layout>
  );
}
