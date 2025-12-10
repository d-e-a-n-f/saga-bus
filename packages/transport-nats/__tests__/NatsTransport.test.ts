import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock nats before imports
vi.mock("nats", () => {
  const createMockConsumer = () => {
    let stopCalled = false;
    const messages: unknown[] = [];
    return {
      consume: vi.fn().mockResolvedValue({
        stop: vi.fn(() => {
          stopCalled = true;
        }),
        [Symbol.asyncIterator]: async function* () {
          while (!stopCalled && messages.length > 0) {
            yield messages.shift();
          }
        },
        __addMessage: (msg: unknown) => messages.push(msg),
        __stopCalled: () => stopCalled,
      }),
    };
  };

  const createMockJsm = () => ({
    streams: {
      info: vi.fn().mockResolvedValue({ config: { name: "SAGA_BUS" } }),
      add: vi.fn().mockResolvedValue({ config: { name: "SAGA_BUS" } }),
    },
    consumers: {
      add: vi.fn().mockResolvedValue({ name: "test-consumer" }),
    },
  });

  const createMockJs = () => {
    const mockConsumer = createMockConsumer();
    return {
      publish: vi.fn().mockResolvedValue({ seq: 1, duplicate: false }),
      consumers: {
        get: vi.fn().mockResolvedValue(mockConsumer),
      },
      __mockConsumer: mockConsumer,
    };
  };

  const mockJsm = createMockJsm();
  const mockJs = createMockJs();

  const mockNc = {
    jetstreamManager: vi.fn().mockResolvedValue(mockJsm),
    jetstream: vi.fn().mockReturnValue(mockJs),
    drain: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return {
    connect: vi.fn().mockResolvedValue(mockNc),
    StringCodec: vi.fn(() => ({
      encode: (s: string) => new TextEncoder().encode(s),
      decode: (b: Uint8Array) => new TextDecoder().decode(b),
    })),
    headers: vi.fn(() => {
      const h = new Map<string, string>();
      return {
        set: (k: string, v: string) => h.set(k, v),
        get: (k: string) => h.get(k),
        has: (k: string) => h.has(k),
        values: (k: string) => (h.has(k) ? [h.get(k)] : []),
      };
    }),
    AckPolicy: { Explicit: "explicit", None: "none", All: "all" },
    DeliverPolicy: { All: "all", Last: "last", New: "new" },
    RetentionPolicy: { Limits: "limits", Interest: "interest", Workqueue: "workqueue" },
    __mockNc: mockNc,
    __mockJsm: mockJsm,
    __mockJs: mockJs,
    __createMockConsumer: createMockConsumer,
    __createMockJsm: createMockJsm,
    __createMockJs: createMockJs,
  };
});

import { NatsTransport } from "../src/NatsTransport.js";
import type { BaseMessage } from "@saga-bus/core";

interface TestMessage extends BaseMessage {
  type: "TestEvent";
  data: string;
}

// Helper to get mock exports with proper typing
async function getMocks() {
  const mod = (await import("nats")) as unknown as {
    connect: ReturnType<typeof vi.fn>;
    StringCodec: ReturnType<typeof vi.fn>;
    headers: ReturnType<typeof vi.fn>;
    __mockNc: {
      jetstreamManager: ReturnType<typeof vi.fn>;
      jetstream: ReturnType<typeof vi.fn>;
      drain: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
    };
    __mockJsm: {
      streams: {
        info: ReturnType<typeof vi.fn>;
        add: ReturnType<typeof vi.fn>;
      };
      consumers: {
        add: ReturnType<typeof vi.fn>;
      };
    };
    __mockJs: {
      publish: ReturnType<typeof vi.fn>;
      consumers: {
        get: ReturnType<typeof vi.fn>;
      };
      __mockConsumer: {
        consume: ReturnType<typeof vi.fn>;
      };
    };
    __createMockConsumer: () => {
      consume: ReturnType<typeof vi.fn>;
    };
    __createMockJsm: () => {
      streams: {
        info: ReturnType<typeof vi.fn>;
        add: ReturnType<typeof vi.fn>;
      };
      consumers: {
        add: ReturnType<typeof vi.fn>;
      };
    };
    __createMockJs: () => {
      publish: ReturnType<typeof vi.fn>;
      consumers: {
        get: ReturnType<typeof vi.fn>;
      };
      __mockConsumer: {
        consume: ReturnType<typeof vi.fn>;
      };
    };
  };
  return mod;
}

describe("NatsTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should throw if no connection or connectionOptions provided", () => {
      expect(() => new NatsTransport({} as any)).toThrow(
        "Either connection or connectionOptions must be provided"
      );
    });

    it("should accept connectionOptions", () => {
      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
      });
      expect(transport).toBeDefined();
    });

    it("should accept existing connection", async () => {
      const { __mockNc } = await getMocks();
      const transport = new NatsTransport({
        connection: __mockNc as any,
      });
      expect(transport).toBeDefined();
    });
  });

  describe("start/stop", () => {
    it("should connect when using connectionOptions", async () => {
      const { connect: mockConnect } = await getMocks();
      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
      });
      await transport.start();
      expect(mockConnect).toHaveBeenCalledWith({ servers: "localhost:4222" });
    });

    it("should use provided connection", async () => {
      const { connect: mockConnect, __mockNc } = await getMocks();
      const transport = new NatsTransport({
        connection: __mockNc as any,
      });
      await transport.start();
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("should be idempotent for start", async () => {
      const { connect: mockConnect } = await getMocks();
      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
      });
      await transport.start();
      await transport.start();
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it("should create JetStream manager and client", async () => {
      const { __mockNc } = await getMocks();
      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
      });
      await transport.start();
      expect(__mockNc.jetstreamManager).toHaveBeenCalled();
      expect(__mockNc.jetstream).toHaveBeenCalled();
    });

    it("should auto-create stream if enabled", async () => {
      const { __mockJsm } = await getMocks();
      __mockJsm.streams.info.mockRejectedValueOnce(new Error("not found"));

      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
        autoCreateStream: true,
        streamName: "TEST_STREAM",
      });
      await transport.start();
      expect(__mockJsm.streams.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "TEST_STREAM",
        })
      );
    });

    it("should not create stream if already exists", async () => {
      const { __mockJsm } = await getMocks();
      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
        autoCreateStream: true,
      });
      await transport.start();
      expect(__mockJsm.streams.add).not.toHaveBeenCalled();
    });

    it("should drain connection on stop when we created it", async () => {
      const { __mockNc } = await getMocks();
      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
      });
      await transport.start();
      await transport.stop();
      expect(__mockNc.drain).toHaveBeenCalled();
    });

    it("should not drain connection on stop if provided externally", async () => {
      const { __mockNc } = await getMocks();
      const transport = new NatsTransport({
        connection: __mockNc as any,
      });
      await transport.start();
      await transport.stop();
      expect(__mockNc.drain).not.toHaveBeenCalled();
    });

    it("should be idempotent for stop", async () => {
      const { __mockNc } = await getMocks();
      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
      });
      await transport.start();
      await transport.stop();
      await transport.stop();
      expect(__mockNc.drain).toHaveBeenCalledTimes(1);
    });
  });

  describe("publish", () => {
    it("should throw if not started", async () => {
      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
      });
      const message: TestMessage = { type: "TestEvent", data: "test" };

      await expect(
        transport.publish(message, { endpoint: "test-topic" })
      ).rejects.toThrow("Transport not started");
    });

    it("should publish message to subject", async () => {
      const { __mockJs } = await getMocks();

      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
      });
      await transport.start();

      const message: TestMessage = { type: "TestEvent", data: "test-data" };
      await transport.publish(message, { endpoint: "orders" });

      expect(__mockJs.publish).toHaveBeenCalledWith(
        "saga-bus.orders.TestEvent",
        expect.any(Uint8Array),
        expect.objectContaining({
          msgID: expect.any(String),
        })
      );
    });

    it("should use custom subject prefix", async () => {
      const { __mockJs } = await getMocks();

      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
        subjectPrefix: "myapp",
      });
      await transport.start();

      const message: TestMessage = { type: "TestEvent", data: "test-data" };
      await transport.publish(message, { endpoint: "orders" });

      expect(__mockJs.publish).toHaveBeenCalledWith(
        "myapp.orders.TestEvent",
        expect.any(Uint8Array),
        expect.anything()
      );
    });

    it("should set message headers", async () => {
      const { __mockJs, headers: mockHeaders } = await getMocks();

      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
      });
      await transport.start();

      const message: TestMessage = { type: "TestEvent", data: "test-data" };
      await transport.publish(message, {
        endpoint: "orders",
        key: "order-123",
        headers: { customHeader: "customValue" },
      });

      expect(mockHeaders).toHaveBeenCalled();
      expect(__mockJs.publish).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Uint8Array),
        expect.objectContaining({
          headers: expect.anything(),
        })
      );
    });

    it("should throw on delayed messages", async () => {
      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
      });
      await transport.start();

      const message: TestMessage = { type: "TestEvent", data: "test-data" };

      await expect(
        transport.publish(message, { endpoint: "orders", delayMs: 5000 })
      ).rejects.toThrow("NATS JetStream does not support delayed messages");
    });
  });

  describe("subscribe", () => {
    it("should throw if not started", async () => {
      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
      });

      await expect(
        transport.subscribe({ endpoint: "orders" }, vi.fn())
      ).rejects.toThrow("Transport not started");
    });

    it("should create durable consumer", async () => {
      const { __mockJsm } = await getMocks();

      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
      });
      await transport.start();

      await transport.subscribe({ endpoint: "orders" }, vi.fn());

      expect(__mockJsm.consumers.add).toHaveBeenCalledWith(
        "SAGA_BUS",
        expect.objectContaining({
          durable_name: "saga-bus-consumer-orders",
          filter_subject: "saga-bus.orders.>",
          ack_policy: "explicit",
          deliver_policy: "all",
        })
      );
    });

    it("should use custom consumer name from group", async () => {
      const { __mockJsm } = await getMocks();

      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
      });
      await transport.start();

      await transport.subscribe(
        { endpoint: "orders", group: "custom-consumer" },
        vi.fn()
      );

      expect(__mockJsm.consumers.add).toHaveBeenCalledWith(
        "SAGA_BUS",
        expect.objectContaining({
          durable_name: "custom-consumer",
        })
      );
    });

    it("should start consuming messages", async () => {
      const { __mockJs } = await getMocks();

      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
      });
      await transport.start();

      await transport.subscribe({ endpoint: "orders" }, vi.fn());

      expect(__mockJs.consumers.get).toHaveBeenCalledWith(
        "SAGA_BUS",
        "saga-bus-consumer-orders"
      );
      expect(__mockJs.__mockConsumer.consume).toHaveBeenCalled();
    });

    it("should stop consumers on transport stop", async () => {
      const { __mockJs } = await getMocks();

      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
      });
      await transport.start();

      await transport.subscribe({ endpoint: "orders" }, vi.fn());

      // Get the messages iterator
      const consumeResult = await __mockJs.__mockConsumer.consume();

      await transport.stop();

      expect(consumeResult.stop).toHaveBeenCalled();
    });
  });

  describe("stream configuration", () => {
    it("should use default stream name", async () => {
      const { __mockJsm } = await getMocks();
      __mockJsm.streams.info.mockRejectedValueOnce(new Error("not found"));

      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
      });
      await transport.start();

      expect(__mockJsm.streams.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "SAGA_BUS",
        })
      );
    });

    it("should use custom stream configuration", async () => {
      const { __mockJsm } = await getMocks();
      __mockJsm.streams.info.mockRejectedValueOnce(new Error("not found"));

      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
        streamName: "CUSTOM_STREAM",
        retentionPolicy: "limits",
        maxMessages: 1000,
        maxBytes: 1024 * 1024,
        replicas: 3,
      });
      await transport.start();

      expect(__mockJsm.streams.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "CUSTOM_STREAM",
          retention: "limits",
          max_msgs: 1000,
          max_bytes: 1024 * 1024,
          num_replicas: 3,
        })
      );
    });

    it("should set correct subjects for stream", async () => {
      const { __mockJsm } = await getMocks();
      __mockJsm.streams.info.mockRejectedValueOnce(new Error("not found"));

      const transport = new NatsTransport({
        connectionOptions: { servers: "localhost:4222" },
        subjectPrefix: "myapp",
      });
      await transport.start();

      expect(__mockJsm.streams.add).toHaveBeenCalledWith(
        expect.objectContaining({
          subjects: ["myapp.>"],
        })
      );
    });
  });
});
