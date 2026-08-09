import { Request, Response } from 'express';
import { LocationDiagram, Prisma } from '@prisma/client';
import prisma from '../database/Prisma';
import ApiException from '../errors/ApiException';

/**
 * Answer the request instead of rethrowing. A rethrow from an async handler
 * is invisible to Express 4, so it became an unhandled rejection and took the
 * whole API process down -- every "Image is required" click returned a 502
 * while the container restarted.
 */
const handleLocationDiagramError = (
  res: Response,
  error: unknown,
  action: string,
) => {
  if (error instanceof ApiException) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      data: error.data,
    });
  }

  console.error(`Failed to ${action} location diagram:`, error);

  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(422).json({
      success: false,
      message: `Could not ${action} the location diagram. Please check the details and try again.`,
    });
  }

  return res.status(500).json({
    success: false,
    message: `Something went wrong while trying to ${action} the location diagram.`,
  });
};

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
            Client: true,
            Manager: true,
            imoNumber: true,
            vesselType: true,
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
    return handleLocationDiagramError(res, error, 'list');
  }
}

export async function createLocationDiagram(req: Request, res: Response) {
  try {
    const { vesselId } = req.params;
    const user = res.locals.user;
    const { location: locationId, subLocationId, attachmentImageId: attachmentImageId } = req.body;
    const image = req.file;

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
    return handleLocationDiagramError(res, error, 'create');
  }
}

export async function getLocationDiagramById(req: Request, res: Response) {
  try {
    const { LocationDiagramId: id } = req.params;

    if (!id) {
      throw new ApiException(
        'Location diagram ID is required',
        400,
      );
    }

    const locationDiagram = await prisma.locationDiagram.findUnique({
      where: { id },
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
            Client: true,
            Manager: true,
            imoNumber: true,
            vesselType: true,
          }
        },
        Pins: {
          include: {
            PinAttachments: true,
            PinImages: true,
          }
        }
      }
    });

    if (!locationDiagram) {
      throw new ApiException(
        'Location diagram not found',
        404,
      );
    }

    return res.status(200).json({
      success: true,
      data: locationDiagram,
      message: 'Location diagram fetched successfully',
    });
  } catch (error) {
    return handleLocationDiagramError(res, error, 'load');
  }
}