import type { SagaMiddleware, SagaPipelineContext } from "../types/index.js";

/**
 * Executes middleware in order, calling next() to proceed.
 */
export class MiddlewarePipeline {
  private readonly middleware: SagaMiddleware[];

  constructor(middleware: SagaMiddleware[] = []) {
    this.middleware = middleware;
  }

  /**
   * Execute the pipeline with a core handler at the end.
   */
  async execute(
    ctx: SagaPipelineContext,
    coreHandler: () => Promise<void>
  ): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middleware.length) {
        const mw = this.middleware[index];
        index++;
        if (mw) {
          await mw(ctx, next);
        }
      } else {
        // All middleware executed, run core handler
        await coreHandler();
      }
    };

    await next();
  }
}
