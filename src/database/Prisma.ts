import { PrismaClient } from '@prisma/client';

/**
 * Extended Prisma Client with withCount method
 * Returns both data and count for pagination
 */
const extendedPrismaClient = () => {
  const prisma = new PrismaClient().$extends({
    model: {
      $allModels: {
        async withCount<T, A>(
          this: T,
          args?: A & {
            where?: any;
            orderBy?: any;
            skip?: number;
            take?: number;
            include?: any;
            select?: any;
          }
        ): Promise<{ data: any[]; count: number }> {
          const { skip, take, ...rest } = args || {};
          // @ts-ignore - this is type-safe but TypeScript doesn't recognize it
          const dataPromise = (this as any).findMany({
            ...rest,
            skip,
            take,
          });
          
          // @ts-ignore - this is type-safe but TypeScript doesn't recognize it
          const countPromise = (this as any).count({
            // @ts-expect-error - this is type-safe but TypeScript doesn't recognize it
            where: rest?.where,
          });
          
          const [data, count] = await Promise.all([dataPromise, countPromise]);
          
          return { data, count };
        },
      },
    },
  });

  return prisma;
};

// Create an instance of the extended client
const prisma = extendedPrismaClient();

export default prisma;
