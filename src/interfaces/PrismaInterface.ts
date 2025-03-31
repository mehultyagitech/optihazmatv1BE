import { Prisma } from '@prisma/client';

export type where = Prisma.VesselWhereInput;
export type orderBy = Prisma.VesselOrderByWithRelationInput;
export type include = Prisma.VesselInclude;
export type select = Prisma.VesselSelect;

export type findManyArgs = {
  skip?: number;
  take?: number;
  where?: where;
  orderBy?: orderBy;
  include?: include;
  select?: select;
};
