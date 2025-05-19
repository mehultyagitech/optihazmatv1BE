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
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        },
        LocationDiagramImage: {
          select: {
            id: true,
            url: true,
            fileName: true,
          }
        },
        location: {
          select: {
            id: true,
            name: true,
          }
        },
        subLocation: {
          select: {
            id: true,
            name: true,
          }
        },
        vessel: {
          select: {
            id: true,
            clientName: true,
            clientManager: true,
            imoNumber: true,
          }
        }
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

export async function createLocationDiagram(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const user = res.locals.user;
    const { location: locationId, subLocationId, attachmentImageId: attachmentImageId } = req.body;
    const image = req.file;

    console.log('body', req.body);

    if (!vesselId) {
      throw new ApiException(
        'Vessel ID is required',
        400,
      );
    }

    if (!image) {
      throw new ApiException(
        'Image is required',
        400,
      );
    }

    const locationDiagram = await prisma.locationDiagram.create({
      data: {
        locationId,
        subLocationId,
        attachmentImageId,
        userId: user.id,
        vesselId
      }
    });

    const locationDiagramImage = await prisma.locationDiagramImage.create({
      data: {
        fileName: image.originalname,
        url: image.filename,
        locationDiagramId: locationDiagram.id,
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        locationDiagram,
        locationDiagramImage,
      }
    });
  } catch (error) {
    throw error;
  }
}
