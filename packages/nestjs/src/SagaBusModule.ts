import {
  Module,
  DynamicModule,
  Global,
  type Provider,
  type Type,
} from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";
import type {
  SagaBusModuleOptions,
  SagaBusModuleAsyncOptions,
  SagaBusOptionsFactory,
} from "./interfaces/module-options.interface.js";
import { SagaBusService, SAGA_BUS_OPTIONS } from "./SagaBusService.js";
import { MessageExplorer } from "./MessageExplorer.js";
import { SAGA_BUS_TOKEN } from "./decorators/InjectSagaBus.decorator.js";

/**
 * NestJS module for saga-bus integration.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     SagaBusModule.forRoot({
 *       transport: new InMemoryTransport(),
 *       store: new InMemorySagaStore(),
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({})
export class SagaBusModule {
  /**
   * Configure the module with static options.
   */
  static forRoot(options: SagaBusModuleOptions): DynamicModule {
    return {
      module: SagaBusModule,
      imports: [DiscoveryModule],
      providers: [
        {
          provide: SAGA_BUS_OPTIONS,
          useValue: options,
        },
        SagaBusService,
        {
          provide: SAGA_BUS_TOKEN,
          useExisting: SagaBusService,
        },
        MessageExplorer,
      ],
      exports: [SagaBusService, SAGA_BUS_TOKEN],
    };
  }

  /**
   * Configure the module with async options.
   */
  static forRootAsync(options: SagaBusModuleAsyncOptions): DynamicModule {
    return {
      module: SagaBusModule,
      imports: [...(options.imports || []), DiscoveryModule],
      providers: [
        ...this.createAsyncProviders(options),
        SagaBusService,
        {
          provide: SAGA_BUS_TOKEN,
          useExisting: SagaBusService,
        },
        MessageExplorer,
      ],
      exports: [SagaBusService, SAGA_BUS_TOKEN],
    };
  }

  private static createAsyncProviders(
    options: SagaBusModuleAsyncOptions
  ): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: SAGA_BUS_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ];
    }

    const useClass = options.useClass || options.useExisting;
    if (!useClass) {
      throw new Error(
        "Invalid async options: provide useFactory or useClass"
      );
    }

    return [
      {
        provide: SAGA_BUS_OPTIONS,
        useFactory: async (factory: SagaBusOptionsFactory) =>
          factory.createSagaBusOptions(),
        inject: [useClass as Type<SagaBusOptionsFactory>],
      },
      ...(options.useClass
        ? [{ provide: options.useClass, useClass: options.useClass }]
        : []),
    ];
  }
}
