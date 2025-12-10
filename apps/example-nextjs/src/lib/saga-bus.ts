import { RabbitMqTransport } from "@saga-bus/transport-rabbitmq";

let transport: RabbitMqTransport | null = null;
let connectPromise: Promise<void> | null = null;

export async function getTransport(): Promise<RabbitMqTransport> {
  if (transport && transport.isConnected()) {
    return transport;
  }

  if (!transport) {
    transport = new RabbitMqTransport({
      uri: process.env.RABBITMQ_URL ?? "amqp://saga:saga@localhost:5672",
      exchange: process.env.RABBITMQ_EXCHANGE ?? "saga-bus",
      exchangeType: "topic",
      durable: true,
    });
  }

  if (!connectPromise) {
    connectPromise = transport.start().catch((err) => {
      console.error("Failed to connect to RabbitMQ:", err);
      connectPromise = null;
      throw err;
    });
  }

  await connectPromise;
  return transport;
}

export async function publishMessage<T extends { type: string }>(
  message: T
): Promise<void> {
  const t = await getTransport();
  await t.publish(message, { endpoint: message.type });
}
