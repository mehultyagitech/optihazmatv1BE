import { PrismaClient } from '@prisma/client';
import {
  PaginatedResponse,
  PaginationParams,
} from '../interfaces/AppCommonInterface';
import { where as whereArgs, findManyArgs } from '../interfaces/PrismaInterface';

/**
 * Extended Prisma Client with withCount method
 * Returns both data and count for pagination
 */
const extendedPrismaClient = () => {
  const prisma = new PrismaClient().$extends({
    model: {
      $allModels: {
        async paginate<T>({
          page = 1,
          limit = 10,
          offset,
          where = {},
          orderBy = {},
          include,
          select,
        }: PaginationParams): Promise<PaginatedResponse<T>> {
          const skip = offset !== undefined ? offset : (page - 1) * limit;
  
          // @ts-expect-error - This works at runtime but TypeScript doesn't know about it
          const totalCount = await this.count({ where });
  
          const queryOptions: whereArgs & findManyArgs = {
            skip,
            take: limit,
            where,
            orderBy,
          };
  
          if (include) queryOptions.include = include;
          if (select) queryOptions.select = select;
  
          // @ts-expect-error - This works at runtime but TypeScript doesn't know about it
          const data = await this.findMany(queryOptions);
  
          return {
            data,
            meta: {
              page,
              limit,
              total: {
                items: totalCount,
                pages: Math.ceil(totalCount / limit),
              },
            },
          };
        },
      },
    },
  });

  return prisma;
};

// Create an instance of the extended client
const prisma = extendedPrismaClient();

export default prisma;
