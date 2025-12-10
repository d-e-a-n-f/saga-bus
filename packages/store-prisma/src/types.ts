/**
 * Minimal Prisma client interface required by the store.
 * This avoids a hard dependency on a specific Prisma version.
 */
export interface PrismaClientLike {
  sagaInstance: {
    findUnique: (args: {
      where: { sagaName_id: { sagaName: string; id: string } };
    }) => Promise<SagaInstanceRecord | null>;

    findFirst: (args: {
      where: {
        sagaName: string;
        correlationId: string;
      };
    }) => Promise<SagaInstanceRecord | null>;

    findMany: (args: {
      where: {
        sagaName: string;
        isCompleted?: boolean;
      };
      orderBy?: { createdAt: "asc" | "desc" };
      take?: number;
      skip?: number;
    }) => Promise<SagaInstanceRecord[]>;

    create: (args: {
      data: SagaInstanceCreateInput;
    }) => Promise<SagaInstanceRecord>;

    update: (args: {
      where: { sagaName_id: { sagaName: string; id: string } };
      data: SagaInstanceUpdateInput;
    }) => Promise<SagaInstanceRecord>;

    updateMany: (args: {
      where: {
        sagaName: string;
        id: string;
        version: number;
      };
      data: SagaInstanceUpdateInput;
    }) => Promise<{ count: number }>;

    delete: (args: {
      where: { sagaName_id: { sagaName: string; id: string } };
    }) => Promise<SagaInstanceRecord>;

    deleteMany: (args: {
      where: {
        sagaName: string;
        isCompleted?: boolean;
        updatedAt?: { lt: Date };
      };
    }) => Promise<{ count: number }>;

    count: (args: {
      where: {
        sagaName: string;
        isCompleted?: boolean;
      };
    }) => Promise<number>;
  };
}

/**
 * Shape of a SagaInstance record from Prisma.
 */
export interface SagaInstanceRecord {
  id: string;
  sagaName: string;
  correlationId: string;
  version: number;
  isCompleted: boolean;
  state: unknown; // Json
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a SagaInstance.
 */
export interface SagaInstanceCreateInput {
  id: string;
  sagaName: string;
  correlationId: string;
  version: number;
  isCompleted: boolean;
  state: unknown;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Input for updating a SagaInstance.
 */
export interface SagaInstanceUpdateInput {
  version?: number;
  isCompleted?: boolean;
  state?: unknown;
  updatedAt?: Date;
}

/**
 * Options for creating a PrismaSagaStore.
 */
export interface PrismaSagaStoreOptions {
  /**
   * Prisma client instance.
   */
  prisma: PrismaClientLike;
}
