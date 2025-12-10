import { Injectable, OnModuleInit } from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import type { MessageEnvelope } from "@saga-bus/core";
import {
  MESSAGE_HANDLER_METADATA,
  type MessageHandlerMetadata,
} from "./decorators/MessageHandler.decorator.js";
import { SagaBusService } from "./SagaBusService.js";

/**
 * Discovers and registers message handlers marked with @MessageHandler.
 */
@Injectable()
export class MessageExplorer implements OnModuleInit {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly sagaBusService: SagaBusService
  ) {}

  onModuleInit(): void {
    this.exploreMessageHandlers();
  }

  private exploreMessageHandlers(): void {
    const providers = this.discoveryService.getProviders();

    for (const wrapper of providers) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) continue;

      const handlers: MessageHandlerMetadata[] =
        Reflect.getMetadata(MESSAGE_HANDLER_METADATA, metatype) || [];

      for (const handler of handlers) {
        this.registerMessageHandler(handler, instance);
      }
    }
  }

  private registerMessageHandler(
    handler: MessageHandlerMetadata,
    instance: object
  ): void {
    const transport = this.sagaBusService.getTransport();
    const method = (
      instance as Record<string | symbol, (...args: unknown[]) => unknown>
    )[handler.methodName];

    if (typeof method !== "function") {
      return;
    }

    // Subscribe to the message type
    void transport.subscribe(
      { endpoint: handler.messageType },
      async (envelope: MessageEnvelope) => {
        await method.call(instance, envelope.payload, envelope);
      }
    );
  }
}
