import "reflect-metadata";

export const MESSAGE_HANDLER_METADATA = "saga-bus:message-handler";

/**
 * Metadata for a message handler.
 */
export interface MessageHandlerMetadata {
  messageType: string;
  methodName: string | symbol;
}

/**
 * Decorator to mark a method as a message handler.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class NotificationService {
 *   @MessageHandler("OrderCreated")
 *   async onOrderCreated(payload: OrderCreatedPayload): Promise<void> {
 *     // Handle message
 *   }
 * }
 * ```
 */
export function MessageHandler(messageType: string): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    _descriptor: PropertyDescriptor
  ) => {
    const handlers: MessageHandlerMetadata[] =
      Reflect.getMetadata(MESSAGE_HANDLER_METADATA, target.constructor) || [];
    handlers.push({
      messageType,
      methodName: propertyKey,
    });
    Reflect.defineMetadata(
      MESSAGE_HANDLER_METADATA,
      handlers,
      target.constructor
    );
  };
}
