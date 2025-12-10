import type { SagaBus } from "./createSagaBus.js";

/**
 * Context provided to saga-enabled API handlers.
 */
export interface SagaBusContext {
  sagaBus: SagaBus;
}

/**
 * Handler function with saga bus context.
 */
export type SagaBusHandler = (
  request: Request,
  context: SagaBusContext
) => Promise<Response>;

/**
 * Wrap an API handler with saga bus context.
 *
 * @example
 * ```typescript
 * // app/api/orders/route.ts
 * import { withSagaBus } from "@saga-bus/nextjs/server";
 * import { sagaBus } from "@/lib/saga-bus";
 *
 * export const POST = withSagaBus(sagaBus, async (req, { sagaBus }) => {
 *   const body = await req.json();
 *   await sagaBus.publish({
 *     type: "OrderCreated",
 *     ...body,
 *   });
 *   return new Response("OK");
 * });
 * ```
 */
export function withSagaBus(
  bus: SagaBus,
  handler: SagaBusHandler
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    return handler(request, { sagaBus: bus });
  };
}
