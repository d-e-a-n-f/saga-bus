export interface Config {
  rabbitmq: {
    url: string;
    exchange: string;
  };
  postgres: {
    connectionString: string;
  };
  server: {
    port: number;
    host: string;
  };
}

export function loadConfig(): Config {
  return {
    rabbitmq: {
      url: process.env.RABBITMQ_URL ?? "amqp://saga:saga@localhost:5672",
      exchange: process.env.RABBITMQ_EXCHANGE ?? "saga-bus",
    },
    postgres: {
      connectionString:
        process.env.DATABASE_URL ??
        "postgresql://saga:saga@localhost:5432/saga_bus",
    },
    server: {
      port: parseInt(process.env.PORT ?? "3000", 10),
      host: process.env.HOST ?? "0.0.0.0",
    },
  };
}
