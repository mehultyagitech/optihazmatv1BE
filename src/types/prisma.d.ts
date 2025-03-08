import { PrismaClient } from '@prisma/client'

declare global {
  // This adds the withCount method to all models
  namespace PrismaClient {
    export interface Prisma {
      $allModels: {
        withCount<T = any>(args?: {
          where?: any;
          orderBy?: any;
          skip?: number;
          take?: number;
          include?: any;
          select?: any;
        }): Promise<{ data: T[]; count: number }>;
      }
    }
  }
}

export {}
