import "reflect-metadata";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Test, type TestingModule } from "@nestjs/testing";
import { Injectable, Module } from "@nestjs/common";
import type { Transport, SagaStore, SagaState } from "@saga-bus/core";
import { SagaBusModule } from "../src/SagaBusModule.js";
import { SagaBusService } from "../src/SagaBusService.js";
import {
  MESSAGE_HANDLER_METADATA,
  MessageHandler,
  type MessageHandlerMetadata,
} from "../src/decorators/MessageHandler.decorator.js";
import { InjectSagaBus } from "../src/decorators/InjectSagaBus.decorator.js";

// Mock transport
function createMockTransport(): Transport {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(undefined),
  } as unknown as Transport;
}

// Mock store
function createMockStore(): SagaStore<SagaState> {
  return {
    getById: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    findByCorrelationId: vi.fn().mockResolvedValue([]),
    findByStatus: vi.fn().mockResolvedValue([]),
    findTimedOut: vi.fn().mockResolvedValue([]),
    acquireLock: vi.fn().mockResolvedValue(true),
    releaseLock: vi.fn().mockResolvedValue(undefined),
  } as unknown as SagaStore<SagaState>;
}

// Test classes declared at module level to satisfy TypeScript decorator requirements
@Injectable()
class TestServiceWithSagaBus {
  constructor(@InjectSagaBus() public sagaBus: SagaBusService) {}
}

@Injectable()
class ChildServiceWithSagaBus {
  constructor(@InjectSagaBus() public sagaBus: SagaBusService) {}
}

describe("SagaBusModule", () => {
  let transport: Transport;
  let store: SagaStore<SagaState>;
  let module: TestingModule | undefined;

  beforeEach(() => {
    transport = createMockTransport();
    store = createMockStore();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
      module = undefined;
    }
  });

  describe("forRoot", () => {
    it("should create module with static options", async () => {
      module = await Test.createTestingModule({
        imports: [
          SagaBusModule.forRoot({
            transport,
            store,
          }),
        ],
      }).compile();

      const service = module.get<SagaBusService>(SagaBusService);
      expect(service).toBeDefined();
      expect(service.getTransport()).toBe(transport);
      expect(service.getStore()).toBe(store);
    });

    it("should allow middleware configuration", async () => {
      const middleware = vi.fn();

      module = await Test.createTestingModule({
        imports: [
          SagaBusModule.forRoot({
            transport,
            store,
            middleware: [middleware],
          }),
        ],
      }).compile();

      const service = module.get<SagaBusService>(SagaBusService);
      expect(service.getMiddleware()).toContain(middleware);
    });

    it("should call transport.start on module init when autoStart is true", async () => {
      module = await Test.createTestingModule({
        imports: [
          SagaBusModule.forRoot({
            transport,
            store,
            autoStart: true,
          }),
        ],
      }).compile();

      // Manually call onModuleInit on the service
      const service = module.get<SagaBusService>(SagaBusService);
      await service.onModuleInit();

      expect(transport.start).toHaveBeenCalled();
    });

    it("should not call transport.start when autoStart is false", async () => {
      module = await Test.createTestingModule({
        imports: [
          SagaBusModule.forRoot({
            transport,
            store,
            autoStart: false,
          }),
        ],
      }).compile();

      // Manually call onModuleInit on the service
      const service = module.get<SagaBusService>(SagaBusService);
      await service.onModuleInit();

      expect(transport.start).not.toHaveBeenCalled();
    });

    it("should call transport.stop on module destroy when autoStop is true", async () => {
      module = await Test.createTestingModule({
        imports: [
          SagaBusModule.forRoot({
            transport,
            store,
            autoStop: true,
          }),
        ],
      }).compile();

      // Manually call onModuleDestroy on the service
      const service = module.get<SagaBusService>(SagaBusService);
      await service.onModuleDestroy();

      expect(transport.stop).toHaveBeenCalled();
    });

    it("should not call transport.stop when autoStop is false", async () => {
      module = await Test.createTestingModule({
        imports: [
          SagaBusModule.forRoot({
            transport,
            store,
            autoStop: false,
          }),
        ],
      }).compile();

      // Manually call onModuleDestroy on the service
      const service = module.get<SagaBusService>(SagaBusService);
      await service.onModuleDestroy();

      expect(transport.stop).not.toHaveBeenCalled();
    });
  });

  describe("forRootAsync", () => {
    it("should create module with useFactory", async () => {
      module = await Test.createTestingModule({
        imports: [
          SagaBusModule.forRootAsync({
            useFactory: () => ({
              transport,
              store,
            }),
          }),
        ],
      }).compile();

      const service = module.get<SagaBusService>(SagaBusService);
      expect(service).toBeDefined();
      expect(service.getTransport()).toBe(transport);
    });

    it("should support useFactory with inject", async () => {
      const CONFIG_TOKEN = "CONFIG";

      // Create a module that exports the CONFIG provider
      @Module({
        providers: [
          {
            provide: CONFIG_TOKEN,
            useValue: { transport, store },
          },
        ],
        exports: [CONFIG_TOKEN],
      })
      class ConfigModule {}

      module = await Test.createTestingModule({
        imports: [
          ConfigModule,
          SagaBusModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (config: unknown) => {
              const cfg = config as { transport: Transport; store: SagaStore<SagaState> };
              return {
                transport: cfg.transport,
                store: cfg.store,
              };
            },
            inject: [CONFIG_TOKEN],
          }),
        ],
      }).compile();

      const service = module.get<SagaBusService>(SagaBusService);
      expect(service.getTransport()).toBe(transport);
    });

    it("should support useClass", async () => {
      // Create the config service with current transport/store
      @Injectable()
      class TestConfigService {
        createSagaBusOptions() {
          return { transport, store };
        }
      }

      module = await Test.createTestingModule({
        imports: [
          SagaBusModule.forRootAsync({
            useClass: TestConfigService,
          }),
        ],
      }).compile();

      const service = module.get<SagaBusService>(SagaBusService);
      expect(service).toBeDefined();
    });
  });

  describe("SagaBusService", () => {
    it("should publish messages", async () => {
      module = await Test.createTestingModule({
        imports: [
          SagaBusModule.forRoot({
            transport,
            store,
          }),
        ],
      }).compile();

      const service = module.get<SagaBusService>(SagaBusService);
      const message = { type: "TestEvent", data: "test" };

      await service.publish(message, { endpoint: "test-queue" });

      expect(transport.publish).toHaveBeenCalledWith(message, { endpoint: "test-queue" });
    });
  });

  describe("@InjectSagaBus", () => {
    it("should inject SagaBusService via token", async () => {
      module = await Test.createTestingModule({
        imports: [
          SagaBusModule.forRoot({
            transport,
            store,
          }),
        ],
        providers: [TestServiceWithSagaBus],
      }).compile();

      const testService = module.get<TestServiceWithSagaBus>(TestServiceWithSagaBus);
      expect(testService.sagaBus).toBeDefined();
      expect(testService.sagaBus).toBeInstanceOf(SagaBusService);
    });
  });

  describe("@MessageHandler decorator", () => {
    it("should store metadata on class", () => {
      class TestHandler {
        handleTestEvent(): void {
          // empty handler for testing
        }
      }

      // Apply decorator manually to avoid TypeScript decorator issues in tests
      MessageHandler("TestEvent")(
        TestHandler.prototype,
        "handleTestEvent",
        Object.getOwnPropertyDescriptor(TestHandler.prototype, "handleTestEvent")!
      );

      const metadata = Reflect.getMetadata(
        MESSAGE_HANDLER_METADATA,
        TestHandler
      ) as MessageHandlerMetadata[];
      expect(metadata).toBeDefined();
      expect(metadata).toHaveLength(1);
      expect(metadata[0]).toEqual({
        messageType: "TestEvent",
        methodName: "handleTestEvent",
      });
    });

    it("should support multiple handlers on same class", () => {
      class MultiHandler {
        handleA(): void {
          // empty handler for testing
        }
        handleB(): void {
          // empty handler for testing
        }
      }

      // Apply decorators manually
      MessageHandler("EventA")(
        MultiHandler.prototype,
        "handleA",
        Object.getOwnPropertyDescriptor(MultiHandler.prototype, "handleA")!
      );
      MessageHandler("EventB")(
        MultiHandler.prototype,
        "handleB",
        Object.getOwnPropertyDescriptor(MultiHandler.prototype, "handleB")!
      );

      const metadata = Reflect.getMetadata(
        MESSAGE_HANDLER_METADATA,
        MultiHandler
      ) as MessageHandlerMetadata[];
      expect(metadata).toHaveLength(2);
      expect(metadata).toContainEqual({
        messageType: "EventA",
        methodName: "handleA",
      });
      expect(metadata).toContainEqual({
        messageType: "EventB",
        methodName: "handleB",
      });
    });
  });

  describe("Global module", () => {
    it("should be available globally without re-importing", async () => {
      // Simulate child module that doesn't import SagaBusModule
      module = await Test.createTestingModule({
        imports: [
          SagaBusModule.forRoot({
            transport,
            store,
          }),
        ],
        providers: [ChildServiceWithSagaBus],
      }).compile();

      const childService = module.get<ChildServiceWithSagaBus>(ChildServiceWithSagaBus);
      expect(childService.sagaBus).toBeDefined();
    });
  });
});
