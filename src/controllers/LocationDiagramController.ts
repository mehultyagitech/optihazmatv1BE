import { Request, Response } from 'express';
import { LocationDiagram, Prisma } from '@prisma/client';
import prisma from '../database/Prisma';
import ApiException from '../errors/ApiException';

export async function getAllLocationDiagrams(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const { search } = req.query;
    const pagination = res.locals.pagination;
    const { page, limit, offset } = pagination;

    if (!vesselId) {
      throw new ApiException(
        'Vessel ID is required',
        400,
      );
    }
    
    const where: Prisma.LocationDiagramWhereInput = {
      vesselId: vesselId as string,
      ...(search && {
        location: {
          name: {
            contains: String(search).toLowerCase(),
          },
        },
      }),
    };

    const response = await prisma.locationDiagram.paginate<LocationDiagram>({
      page: Number(page),
      limit: Number(limit),
      offset,
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        AttachmentImage: true,
        location: true
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        locationDiagrams: response.data,
        meta: {
          page: response.meta.page,
          limit: response.meta.limit,
          total: {
            items: response.meta.total.items,
            pages: response.meta.total.pages,
          },
        },
      },
      message: 'Location diagrams fetched successfully',
    });
  } catch (error) {
    throw error;
  }
}
