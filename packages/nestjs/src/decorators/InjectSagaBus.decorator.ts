import { Inject } from "@nestjs/common";

export const SAGA_BUS_TOKEN = "SAGA_BUS";

/**
 * Decorator to inject the SagaBusService.
 */
export function InjectSagaBus(): ParameterDecorator {
  return Inject(SAGA_BUS_TOKEN);
}
